require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const faq = JSON.parse(fs.readFileSync("faq.json", "utf8"));

app.get("/", (req, res) => {
    res.send("API Rodando!");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const supabase = require("./supabase");

const broadcast = (message) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
};

app.get("/users", async (req, res) => {
    const { data, error } = await supabase.from("users").select("*");

    if (error) {
        return res.status(400).json(error);
    }

    res.json(data);
});


app.get("/user-by-email", async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
    }

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

    if (error) {
        return res.status(400).json(error);
    }

    if (!data) {
        return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(data);
});

app.post("/register", async (req, res) => {
    const { email, password, name } = req.body;

    // Cria usuário no Supabase Auth
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    // Insere o usuário na tabela "users"
    const { data: userData, error: userError } = await supabase
        .from("users")
        .insert([{ id: data.user.id, email, name }]);

    if (userError) {
        return res.status(400).json({ error: userError.message });
    }

    return res.status(201).json(userData);
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    // Busca o usuário pelo email
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

    if (userError || !user) {
        return res.status(400).json({ error: "Usuário não encontrado" });
    }

    // Verifica a senha com a autenticação do Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (authError) {
        return res.status(400).json({ error: "Credenciais inválidas" });
    }

    res.status(200).json({ user, session: authData.session });
});

app.post("/transactions", async (req, res) => {
    const { user_id, description, type, amount, category, date } = req.body;

    const { data, error } = await supabase
        .from("transactions")
        .insert([{ user_id, description, type, amount, category, date }])
        .select();

    if (error) {
        return res.status(400).json(error); // Adicione "return" para evitar múltiplas respostas
    }

    broadcast({ type: "update" });
    return res.status(201).json(data); // Retorna a resposta e evita erro
});

app.get("/transactions", async (req, res) => {
    const { user_id } = req.query; // Recebe o ID do usuário da query string

    if (!user_id) {
        return res.status(400).json({ error: "Usuário não autenticado" });
    }

    const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user_id); // Filtra transações pelo usuário

    if (error) {
        return res.status(400).json(error);
    }

    res.json(data);
});

app.put("/transactions/:id", async (req, res) => {
    const { id } = req.params;
    const { description, type, amount, category, date } = req.body;

    const { error } = await supabase
        .from("transactions")
        .update({ description, type, amount, category, date })
        .eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    broadcast({ type: "update" });
    res.json({ message: "Transação atualizada com sucesso." });
});

app.delete("/transactions/:id", async(req, res) => {
    const {id} = req.params;

    const {error} = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    broadcast({ type: "update" });
    res.json({message: "Transação removida com sucesso."});
});

app.post("/api/chat", async (req, res) => {
    const { message, user_id } = req.body;

    if (!message || !user_id) {
        return res.status(400).json({ error: "Mensagem ou usuário não fornecido." });
    }

    const lowerMessage = message.toLowerCase();
    const foundQuestion = faq.find(q => lowerMessage.includes(q.question.toLowerCase()));

    // Perguntas sugeridas padrão
    const suggestedQuestions = [
        "Como posso economizar mais?",
        "Quanto gastei este mês?",
        "Qual foi minha maior despesa?"
    ];

    if (lowerMessage.includes("quanto gastei este mês")) {
        const currentMonth = new Date().getMonth() + 1;
        const { data, error } = await supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", user_id)
            .gte("date", `${new Date().getFullYear()}-${currentMonth}-01`)
            .lte("date", `${new Date().getFullYear()}-${currentMonth}-31`);
        
        if (error) {
            return res.status(500).json({ error: "Erro ao buscar transações." });
        }
        
        const totalSpent = data.reduce((sum, transaction) => sum + transaction.amount, 0);
        return res.json({ reply: `Você gastou um total de R$ ${totalSpent.toFixed(2)} neste mês.`, suggestedQuestions });
    }

    if (lowerMessage.includes("qual foi minha maior despesa")) {
        const { data, error } = await supabase
            .from("transactions")
            .select("description, amount")
            .eq("user_id", user_id)
            .eq("type", "expense")
            .order("amount", { ascending: false })
            .limit(1);
        
        if (error || !data.length) {
            return res.json({ reply: "Não foi possível encontrar sua maior despesa.", suggestedQuestions });
        }
        
        return res.json({ reply: `Sua maior despesa foi com ${data[0].description}, no valor de R$ ${data[0].amount.toFixed(2)}.`, suggestedQuestions });
    }

    if (foundQuestion) {
        return res.json({ reply: foundQuestion.answer, suggestedQuestions });
    } else {
        return res.json({ reply: "Desculpe, não entendi sua pergunta. Tente reformular.", suggestedQuestions });
    }
});

app.post("/budgets", async (req, res) => {
    const { user_id, category, limit_amount } = req.body;

    const { data, error } = await supabase
        .from("budgets")
        .insert([{ user_id, category, limit_amount }])
        .select();

    if (error) {
        return res.status(400).json(error);
    }

    return res.status(201).json(data);
});

app.get("/budgets", async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ error: "Usuário não autenticado" });
    }

    const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("user_id", user_id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json(data);
});

app.put("/budgets/:id", async (req, res) => {
    const { id } = req.params;
    const { category, limit_amount } = req.body;

    const { error } = await supabase
        .from("budgets")
        .update({ category, limit_amount })
        .eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json({ message: "Orçamento atualizado com sucesso." });
});

app.delete("/budgets/:id", async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json({ message: "Orçamento removido com sucesso." });
});

app.post("/goals", async (req, res) => {
    const { user_id, title, goal_amount, deadline } = req.body;

    const { data, error } = await supabase
        .from("goals")
        .insert([{ user_id, title, goal_amount, deadline }])
        .select();

    if (error) {
        return res.status(400).json(error);
    }

    return res.status(201).json(data);
});

app.get("/goals", async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ error: "Usuário não autenticado" });
    }

    const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user_id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json(data);
});

app.put("/goals/:id", async (req, res) => {
    const { id } = req.params;
    const { title, goal_amount, saved_amount, deadline } = req.body;

    const { error } = await supabase
        .from("goals")
        .update({ title, goal_amount, saved_amount, deadline })
        .eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json({ message: "Meta atualizada com sucesso." });
});

app.delete("/goals/:id", async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json({ message: "Meta removida com sucesso." });
});

app.post("/goal-contributions", async (req, res) => {
    const { goal_id, user_id, amount, date } = req.body;

    const { data, error } = await supabase
        .from("goal_contributions")
        .insert([{ goal_id, user_id, amount, date }])
        .select();

    if (error) {
        return res.status(400).json(error);
    }

    return res.status(201).json(data);
});

app.get("/goal-contributions", async (req, res) => {
    const { goal_id, user_id } = req.query;

    if (!goal_id || !user_id) {
        return res.status(400).json({ error: "goal_id e user_id são obrigatórios" });
    }

    const { data, error } = await supabase
        .from("goal_contributions")
        .select("*")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .order("date", { ascending: false }); // Retorna as contribuições mais recentes primeiro

    if (error) {
        return res.status(400).json(error);
    }

    res.json(data);
});

app.put("/goal-contributions/:id", async (req, res) => {
    const { id } = req.params;
    const { amount, date } = req.body;

    const { error } = await supabase
        .from("goal_contributions")
        .update({ amount, date })
        .eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json({ message: "Contribuição atualizada com sucesso." });
});

app.delete("/goal-contributions/:id", async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from("goal_contributions")
        .delete()
        .eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json({ message: "Contribuição removida com sucesso." });
});

app.get("/goal-contributions/total", async (req, res) => {
    const { goal_id, user_id } = req.query;

    if (!goal_id || !user_id) {
        return res.status(400).json({ error: "goal_id e user_id são obrigatórios" });
    }

    const { data, error } = await supabase
        .from("goal_contributions")
        .select("amount")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id);

    if (error) {
        return res.status(400).json(error);
    }

    const totalContributed = data.reduce((sum, contrib) => sum + contrib.amount, 0);

    res.json({ totalContributed });
});
