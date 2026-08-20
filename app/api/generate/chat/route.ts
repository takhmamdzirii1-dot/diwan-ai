import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';

// Point Cost Mapping
const MODEL_COSTS: Record<string, number> = {
  'deepseek/deepseek-r1:free': 0,
  'google/gemini-2.0-flash-exp:free': 0,
  'google/gemini-2.0-flash-thinking-exp:free': 0,
  'meta-llama/llama-3.1-8b-instruct:free': 0,
  'mistralai/mistral-7b-instruct:free': 0,
  'deepseek/deepseek-chat:free': 0,
  'anthropic/claude-3.5-sonnet': 25,
  'openai/gpt-4o': 30,
  'flux-1-pro': 65,
  'kling-ai-1-5': 240,
};

// Resilient Pool of Active Free Models for Cascade Fallback
const FREE_MODELS_POOL = [
  'deepseek/deepseek-r1:free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-2.0-flash-thinking-exp:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'deepseek/deepseek-chat:free',
];

async function callOpenRouter(modelId: string, prompt: string, apiKey: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://diwan-ai.vercel.app',
        'X-Title': 'VANTRA AI',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert AI assistant hosted on VANTRA, the premier unified AI gateway for Algeria. Provide well-structured, helpful, and insightful answers with clean markdown formatting. You are fully fluent in English, French, and Algerian Darja.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return { ok: false, status: response.status, data: null };
    }

    const data = await response.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;

    // Validate that response contains actual generated content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, status: 204, data: null };
    }

    // Check for rate limit or unavailable text in content
    if (
      content.includes('unavailable for free') ||
      content.includes('No endpoints found') ||
      content.includes('temporarily unavailable')
    ) {
      return { ok: false, status: 503, data: null };
    }

    return { ok: true, status: 200, data, content };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message || 'Network error' };
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authentication
    let user = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    } else {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to use your AI balance.' },
        { status: 401 }
      );
    }

    // 2. Parse Request Body
    const body = await request.json().catch(() => ({}));
    const { prompt, model = 'deepseek/deepseek-r1:free' } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const requestedModel = model.trim();
    const cost = MODEL_COSTS[requestedModel] ?? 0;

    // 3. Atomic Point Deduction (0 cost models bypass deduction)
    let deductSuccess = cost === 0;
    let newBalance = 10000;

    if (cost > 0) {
      // Try RPC deduct_user_points
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('deduct_user_points', {
          user_id: user.id,
          cost: cost,
          action: 'CHAT_QUERY',
          model: requestedModel,
        });

        if (!rpcError && rpcResult) {
          deductSuccess = true;
          newBalance = typeof rpcResult === 'number' ? rpcResult : (rpcResult.balance ?? 10000);
        }
      } catch {}

      // Fallback: Check profile table balance if RPC is not deployed
      if (!deductSuccess) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance, points')
          .eq('id', user.id)
          .single();

        const currentBalance = profile?.balance ?? profile?.points ?? 10000;
        if (currentBalance < cost) {
          return NextResponse.json(
            { error: 'Insufficient balance. Please top up your DZD points.' },
            { status: 402 }
          );
        }

        const updated = currentBalance - cost;
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ balance: updated, updated_at: new Date().toISOString() })
          .eq('id', user.id);

        if (!updateError) {
          deductSuccess = true;
          newBalance = updated;

          try {
            await supabase.from('points_ledger').insert({
              user_id: user.id,
              amount: -cost,
              operation: 'CHAT_QUERY',
              model: requestedModel,
              created_at: new Date().toISOString(),
            });
          } catch {}
        } else {
          deductSuccess = true;
          newBalance = Math.max(0, currentBalance - cost);
        }
      }
    }

    // 4. Multi-Model Cascade Execution
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured in server environment.' },
        { status: 500 }
      );
    }

    let finalContent = '';
    let finalModel = requestedModel;
    let tokensUsed = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Build candidate execution sequence: requested model first, then the free pool
    const candidates = [
      requestedModel,
      ...FREE_MODELS_POOL.filter((m) => m !== requestedModel),
    ];

    let success = false;

    for (const candidateModel of candidates) {
      const callRes = await callOpenRouter(candidateModel, prompt, openRouterApiKey);

      if (callRes.ok && callRes.content) {
        finalContent = callRes.content;
        finalModel = candidateModel;
        tokensUsed = callRes.data?.usage || tokensUsed;
        success = true;
        break;
      }
    }

    if (!success) {
      // Refund if all candidates failed
      if (cost > 0) {
        try {
          await supabase.rpc('refund_user_points', {
            user_id: user.id,
            cost: cost,
            reason: 'PROVIDER_EXECUTION_FAILURE',
          });
        } catch {}
      }

      return NextResponse.json(
        {
          error:
            'All AI engine endpoints are currently busy. Please try again in a few seconds.',
        },
        { status: 503 }
      );
    }

    // 5. Success Response
    return NextResponse.json({
      success: true,
      response: finalContent,
      model: finalModel,
      requestedModel: requestedModel,
      costDeducted: cost,
      remainingBalance: newBalance,
      usage: tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
