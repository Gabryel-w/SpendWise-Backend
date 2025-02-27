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

app.post("/api/chat", (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Mensagem não fornecida." });
    }

    const lowerMessage = message.toLowerCase();
    const foundQuestion = faq.find(q => lowerMessage.includes(q.question.toLowerCase()));

    // Perguntas sugeridas padrão
    const suggestedQuestions = [
        "Como posso economizar mais?",
        "Quanto gastei este mês?",
        "Qual foi minha maior despesa?"
    ];

    if (foundQuestion) {
        return res.json({ reply: foundQuestion.answer, suggestedQuestions });
    } else {
        return res.json({ reply: "Desculpe, não entendi sua pergunta. Tente reformular.", suggestedQuestions });
    }
});