// Restringe una ruta a uno o varios roles. Debe usarse despues de `auth`.
module.exports = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
};
