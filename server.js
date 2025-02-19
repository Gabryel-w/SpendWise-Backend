require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("API Rodando!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const supabase = require("./supabase");

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

    res.json({ message: "Transação atualizada com sucesso." });
});

app.delete("/transactions/:id", async(req, res) => {
    const {id} = req.params;

    const {error} = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
        return res.status(400).json(error);
    }

    res.json({message: "Transação removida com sucesso."});
});