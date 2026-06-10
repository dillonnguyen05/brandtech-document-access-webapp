import express from 'express';

const router = express.Router();
router.get('/pending',(req,res) =>{
    res.json({ message: "Admin users route works" });
    });

router.post("/:userId/approve", (req, res) => {
  res.json({
    method: req.method,
    userId: req.params.userId,
    body: req.body,
    message: "User approval received"
  });
});

router.patch("/:userId/status", (req, res) => {
  res.json({
    method: req.method,
    userId: req.params.userId,
    newStatus: req.body.status
  });
});

router.delete("/:userId", (req, res) => {
  res.json({
    method: req.method,
    userId: req.params.userId,
    message: "Delete request received"
  });
});

export default router;