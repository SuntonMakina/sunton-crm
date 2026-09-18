export async function getResolvedGatewayUrl(supabase: any): Promise<string> {
  // 1. Check direct local gateway on port 3001 (fastest & most reliable when running on local machine)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 400)
    const localRes = await fetch('http://localhost:3001/health', { signal: controller.signal })
    clearTimeout(timeout)
    if (localRes.ok) {
      return 'http://localhost:3001'
    }
  } catch (e) {
    // Not running or not reachable on localhost:3001
  }

  // 2. Check dynamic gateway URL stored in database (e.g. Cloudflare / ngrok tunnel)
  try {
    const { data: dbUrl } = await supabase.rpc('get_whatsapp_gateway_url')
    if (dbUrl && typeof dbUrl === 'string' && dbUrl.startsWith('http') && !dbUrl.includes('localhost')) {
      return dbUrl
    }
  } catch (e) {
    console.error('Error fetching dynamic gateway URL from database RPC:', e)
  }

  // 3. Static fallback from environment variable or default
  return process.env.WHATSAPP_GATEWAY_URL || process.env.GATEWAY_PUBLIC_URL || 'http://localhost:3001'
}
