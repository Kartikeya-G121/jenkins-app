import { Request, Response, NextFunction } from 'express';

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const hasXRequestedWith = !!req.header('X-Requested-With');
    const hasSignature = !!req.header('X-Hub-Signature-256');
    if (!hasXRequestedWith && !hasSignature) {
      return res.status(403).json({ error: 'CSRF check failed.' });
    }
  }
  next();
}
