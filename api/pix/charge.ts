import type {VercelRequest, VercelResponse} from '@vercel/node';
import {processPixCharge} from '../../always-fit---complexo-b/server/fruitfy-handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).setHeader('Allow', 'POST, OPTIONS').end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).setHeader('Allow', 'POST, OPTIONS').json({
      success: false,
      message: 'Method Not Allowed',
    });
    return;
  }

  const result = await processPixCharge(req.body);
  for (const [k, v] of Object.entries(result.headers)) {
    if (v) res.setHeader(k, v);
  }
  res.status(result.statusCode).send(result.body);
}
