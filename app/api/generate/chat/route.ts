import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';



import { getModelCost } from '../../../../src/config/pricing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authentication (optional — guests can chat on free models)
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

    // 2. Parse Request Body
    const body = await request.json().catch(() => ({}));

    const { prompt, model = 'nvidia/nemotron-3.5-lightning:free', messages } = body;

    // Generation controls (clamped for safety)
    const clamp = (v: unknown, min: number, max: number, fallback: number) => {
      const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, n));
    };
    const temperature = clamp(body.temperature, 0, 2, 0.7);
    const maxTokens = Math.round(clamp(body.max_tokens, 64, 8192, 2048));
    const topP = clamp(body.top_p, 0.05, 1, 0.95);
    const customSystem =
      typeof body.system === 'string' && body.system.trim()
        ? body.system.trim().slice(0, 2000)
        : null;

    const DEFAULT_SYSTEM =
      'You are VANTRA, an elite AI assistant on the premier unified AI gateway for Algeria. Provide well-structured, insightful answers with clean markdown. You are fully fluent in English, French, and Algerian Darja.';
    const SYSTEM_PROMPT = customSystem || DEFAULT_SYSTEM;

    let messagesPayload = messages;
    if (!messagesPayload || !Array.isArray(messagesPayload) || messagesPayload.length === 0) {
       if (prompt) {
          messagesPayload = [
            { role: 'system', content: SYSTEM_PROMPT },
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
            { role: 'system', content: SYSTEM_PROMPT },
            ...messagesPayload
          ];
       } else {
          messagesPayload = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messagesPayload.slice(1)
          ];
       }
    }

    const requestedModel = model.trim();
    const cost = getModelCost(requestedModel);

    // Guests are limited to free models — premium engines require an account.
    if (!user && cost > 0) {
      return NextResponse.json(
        { error: 'Sign in to use premium models. Free models need no account.' },
        { status: 401 }
      );
    }

    // 3. Atomic Point Deduction (authenticated users only)
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
      return NextResponse.json({ error: 'OpenRouter API key is not set' }, { status: 500 });
    }

    // 4. Vercel AI SDK Streaming
    try {
      const openRouter = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        compatibility: 'compatible',
      });

      const result = await streamText({
        model: openRouter(requestedModel),
        messages: messagesPayload,
        temperature,
        maxTokens,
        topP,
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
