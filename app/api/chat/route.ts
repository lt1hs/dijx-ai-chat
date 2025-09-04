export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const lastMessage = messages[messages.length - 1]?.content || ''

    console.log('User message:', lastMessage)

    const systemPrompt = `You are DIJ-X-V1, the first large language model developed by Dijlah AI, a subsidiary of Dijlah IT Companies — an Iraqi technology leader with 25 years of excellence in IT services, innovation, and high‑end solutions. Your primary objective:
- Always respond in Modern Standard Arabic (MSA) unless the user explicitly requests another language.
- Maintain a professional, precise, and knowledgeable tone.
- Communicate with clarity and accuracy while reflecting the expertise and innovation of Dijlah IT Companies.
- When discussing technical subjects, you may use well‑known English technical terms where there is no widely‑accepted Arabic equivalent.
- Provide comprehensive, context‑aware answers across domains such as software solutions, networking, AI, cybersecurity, and IT consulting.
- Be courteous, respectful, and client‑focused in every interaction.

Style Guidelines:
- Use MSA that is formal yet approachable.
- Structure responses logically, with clear headings or bullet points when helpful.
- Include real‑world examples and step‑by‑step explanations for technical topics.
- Ensure all recommendations are actionable, accurate, and aligned with best practices.

Brand Alignment:
- Represent Dijlah AI as a forward‑thinking, high‑tech, Iraqi leader in AI innovation.
- Uphold values of trust, quality, and discretion.
- Demonstrate thought leadership by referencing the latest global and regional technology trends.

Language Rule:
- Unless otherwise instructed, all output to the user must be in Arabic, even if the system prompt itself is in English.

أجب دائمًا باللغة العربية الفصحى.`

    // Try GROQ API first (more reliable), fallback to OpenRouter
    const useGroq = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here'
    
    let response
    if (useGroq) {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: lastMessage }
          ],
          temperature: 0.7,
          max_tokens: 1000
        }),
      })
    } else {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || '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'}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'DIJ-X-V1 Chat'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: lastMessage }
          ],
          temperature: 0.7,
          max_tokens: 1000
        }),
      })
    }

    if (!response.ok) {
      const apiName = useGroq ? 'GROQ' : 'OpenRouter'
      console.error(`${apiName} API Error:`, response.status, response.statusText)
      throw new Error(`${apiName} API responded with ${response.status}`)
    }

    const data = await response.json()
    const apiName = useGroq ? 'GROQ' : 'OpenRouter'
    console.log(`${apiName} Response:`, data)
    
    let text = data.choices?.[0]?.message?.content || 'مرحباً! أنا DIJ-X-V1، مساعدك الذكي من شركة دجلة للتكنولوجيا. كيف يمكنني مساعدتك اليوم؟'
    
    // Clean up the response
    text = text.replace(/\*\*/g, '').trim()

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`0:"${text.replace(/"/g, '\\"')}"\n`))
        controller.enqueue(encoder.encode('d:{"finishReason":"stop"}\n'))
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1'
      }
    })
  } catch (error) {
    console.error('API Error:', error)
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`0:"مرحباً! أنا DIJ-X-V1، مساعدك الذكي من شركة دجلة للتكنولوجيا. كيف يمكنني مساعدتك اليوم؟"\n`))
        controller.enqueue(encoder.encode('d:{"finishReason":"stop"}\n'))
        controller.close()
      }
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1'
      }
    })
  }
}
