import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

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

    // 3. Atomic Point Deduction
    let deductSuccess = cost === 0;
    
    if (cost > 0) {
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('deduct_user_points', {
          user_id: user.id,
          cost: cost,
          action: 'CHAT_QUERY',
          model: requestedModel,
        });

        if (!rpcError && rpcResult) {
          deductSuccess = true;
        }
      } catch {}

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
          try {
            await supabase.from('points_ledger').insert({
              user_id: user.id,
              amount: -cost,
              operation: 'CHAT_QUERY',
              model: requestedModel,
              created_at: new Date().toISOString(),
            });
          } catch {}
        }
      }
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is not set' }, { status: 500 });
    }

    // 4. Vercel AI SDK Streaming
    try {
      const result = await streamText({
        model: openrouter(requestedModel),
        messages: messagesPayload,
      });
      
      return result.toDataStreamResponse();
    } catch (err: any) {
      // Refund if error during execution
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
        { error: `Stream Error: ${err.message}` },
        { status: 500 }
      );
    }

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
