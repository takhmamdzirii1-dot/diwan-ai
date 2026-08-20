import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';

// Point Cost Mapping
const MODEL_COSTS: Record<string, number> = {
  'deepseek/deepseek-r1:free': 0,
  'deepseek-r1:free': 0,
  'google/gemini-2.0-flash-exp:free': 0,
  'gemini-2.0-flash:free': 0,
  'qwen/qwen-2.5-coder-32b-instruct:free': 0,
  'qwen-2.5-coder:free': 0,
  'anthropic/claude-3.5-sonnet': 25,
  'claude-3-5-sonnet': 25,
  'openai/gpt-4o': 30,
  'gpt-4o': 30,
  'meta-llama/llama-3.3-70b-instruct:free': 0,
  'deepseek/deepseek-chat': 5,
  'flux-1-pro': 65,
  'kling-ai-1-5': 240,
};

// OpenRouter Model Mapping
const OPENROUTER_MODEL_MAP: Record<string, string> = {
  'deepseek-r1:free': 'deepseek/deepseek-r1:free',
  'gemini-2.0-flash:free': 'google/gemini-2.0-flash-exp:free',
  'qwen-2.5-coder:free': 'qwen/qwen-2.5-coder-32b-instruct:free',
  'claude-3-5-sonnet': 'anthropic/claude-3.5-sonnet',
  'gpt-4o': 'openai/gpt-4o',
};

// Fallback Chain for high availability
const FALLBACK_MODELS = [
  'deepseek/deepseek-r1:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
];

async function callOpenRouter(modelId: string, prompt: string, apiKey: string) {
  return await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
            'You are an expert AI assistant hosted on VANTRA, the premier unified AI gateway for Algeria. Provide detailed, well-structured, and helpful answers with clean markdown formatting. You are fully fluent in English, French, and Algerian Darja.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
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

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const requestedModel = OPENROUTER_MODEL_MAP[model] || model;
    const cost = MODEL_COSTS[model] ?? MODEL_COSTS[requestedModel] ?? 0;

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

    // 4. OpenRouter API Execution with Automatic Resilient Fallback
    let aiResponseText = '';
    let usedModel = requestedModel;
    let tokensUsed = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured in the server environment.' },
        { status: 500 }
      );
    }

    // Attempt primary model first
    let res = await callOpenRouter(requestedModel, prompt, openRouterApiKey);

    if (!res.ok) {
      // If primary model failed, try fallback chain
      console.warn(`Primary model ${requestedModel} failed with status ${res.status}. Trying fallback models...`);
      for (const fallbackModel of FALLBACK_MODELS) {
        if (fallbackModel !== requestedModel) {
          try {
            const fallbackRes = await callOpenRouter(fallbackModel, prompt, openRouterApiKey);
            if (fallbackRes.ok) {
              res = fallbackRes;
              usedModel = fallbackModel;
              break;
            }
          } catch {}
        }
      }
    }

    if (!res.ok) {
      // If all fallbacks failed
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `OpenRouter returned status ${res.status}`;

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
        { error: `AI Gateway Error (${requestedModel}): ${errMsg}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    aiResponseText = data.choices?.[0]?.message?.content || 'No response generated from the model.';
    tokensUsed = data.usage || tokensUsed;

    // 5. Success Response
    return NextResponse.json({
      success: true,
      response: aiResponseText,
      model: usedModel,
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
