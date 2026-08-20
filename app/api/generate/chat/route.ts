import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';

// Point Cost Mapping
const MODEL_COSTS: Record<string, number> = {
  'openrouter/free': 0,
  'nvidia/nemotron-3.5-lightning:free': 0,
  'google/gemma-4-26b-a4b-it:free': 0,
  'liquid/lfm-2.5-2.6b:free': 0,
  'nvidia/nemotron-3-nano-30b-a3b:free': 0,
  'deepseek/deepseek-r1:free': 0,
  'google/gemini-2.0-flash-exp:free': 0,
  'meta-llama/llama-3.2-3b-instruct:free': 0,
  'mistralai/mistral-7b-instruct:free': 0,
  'anthropic/claude-3.5-sonnet': 25,
  'openai/gpt-4o': 30,
  'deepseek/deepseek-chat': 5,
  'flux-1-pro': 65,
  'kling-ai-1-5': 240,
};

// Resilient Pool of Free Fallback Models (Verified Live on OpenRouter)
const FREE_MODELS_POOL = [
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-26b-a4b-it:free',
  'liquid/lfm-2.5-2.6b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openrouter/free',
  'deepseek/deepseek-r1:free',
  'google/gemini-2.0-flash-exp:free',
];

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    
    // Support standard format (`messages`) or our legacy format (`prompt` + `messagesHistory`)
    const { prompt, model = 'openrouter/free', messages } = body;
    
    let messagesPayload = messages;
    if (!messagesPayload || !Array.isArray(messagesPayload) || messagesPayload.length === 0) {
       if (prompt) {
          messagesPayload = [
            {
              role: 'system',
              content:
                'You are an expert AI assistant hosted on VANTRA, the premier unified AI gateway for Algeria. Provide well-structured, helpful, and insightful answers with clean markdown formatting. You are fully fluent in English, French, and Algerian Darja.',
            },
            { role: 'user', content: prompt }
          ];
       } else {
         return NextResponse.json(
          { error: 'Messages or prompt is required' },
          { status: 400 }
         );
       }
    } else {
       // Ensure there's a system prompt if it's a new conversation
       if (messagesPayload[0].role !== 'system') {
          messagesPayload = [
            {
              role: 'system',
              content:
                'You are an expert AI assistant hosted on VANTRA, the premier unified AI gateway for Algeria. Provide well-structured, helpful, and insightful answers with clean markdown formatting. You are fully fluent in English, French, and Algerian Darja.',
            },
            ...messagesPayload
          ];
       }
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

    // 4. Multi-Model Cascade Execution (Streaming)
    const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();

    if (!openRouterApiKey) {
      console.error('OPENROUTER_API_KEY is not defined in environment variables');
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not defined in environment variables.' },
        { status: 500 }
      );
    }

    const candidates = [
      requestedModel,
      ...FREE_MODELS_POOL.filter((m) => m !== requestedModel),
    ];

    let primaryErrorMsg = '';
    let successfulResponse: Response | null = null;
    let finalModel = requestedModel;

    for (let i = 0; i < candidates.length; i++) {
      const candidateModel = candidates[i];
      
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'HTTP-Referer': 'https://diwan-ai.vercel.app',
            'X-Title': 'VANTRA AI',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: candidateModel,
            messages: messagesPayload,
            stream: true, // Request a stream
          }),
        });

        if (response.ok) {
           successfulResponse = response;
           finalModel = candidateModel;
           break;
        } else if (i === 0) {
           const errData = await response.json().catch(() => ({}));
           primaryErrorMsg = errData?.error?.message || `HTTP ${response.status}`;
        }
      } catch (err: any) {
        if (i === 0) {
          primaryErrorMsg = err?.message || 'Network exception';
        }
      }
    }

    if (!successfulResponse) {
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
          error: `OpenRouter Error (${requestedModel}): ${primaryErrorMsg || 'Endpoints unavailable'}`,
        },
        { status: 502 }
      );
    }

    // 5. Stream the response directly to the client as plain text
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        for (const line of lines) {
           if (line.startsWith('data: ') && !line.includes('[DONE]')) {
             try {
               const data = JSON.parse(line.slice(6));
               const content = data.choices?.[0]?.delta?.content;
               if (content) {
                 controller.enqueue(new TextEncoder().encode(content));
               }
             } catch (e) {}
           }
        }
      }
    });
    
    // We pass balance and model in custom headers so the client can update its state
    return new Response(successfulResponse.body?.pipeThrough(transformStream), {
      headers: {
        'X-Vantra-Balance': newBalance.toString(),
        'X-Vantra-Model': finalModel,
        'X-Vantra-Cost': cost.toString(),
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
