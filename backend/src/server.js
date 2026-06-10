import express from "express";
import adminUsersRouter from "./routes/adminUsers.js"
const app = express();
app.use(express.json());
app.get('/api/health',(req,res) => {
    res.json({status: "ok"})
});

app.use('/api/admin/users',adminUsersRouter);
app.listen(3000);