function requireCustomer(req, res, next) {
  if (req.userProfile?.role !== "customer") {
    return res.status(403).json({
      error: "Active customer access required."
    });
  }

  return next();
}

export default requireCustomer;
