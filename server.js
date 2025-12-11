const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3000;
const {createClient} = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());

async function login(email, password) {

    const { session, error} = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('Login error:', error.message);
        return;
    }

    return session?.access_token;
}

const USER_TOKEN = login(process.env.USERNAME, process.env.PASSWORD);

if (process.env.RENDER) {
    const APP_URL = process.env.RENDER_EXTERNAL_URL;
    const INTERVAL_MS = 14 * 60 * 1000; // ping every 14 minutes

    async function ping() {
        await fetch(APP_URL); // ping the server (don't care for the response)
        console.log(`${new Date().toISOString()}: Pinged the server`);
    }

    setInterval(ping, INTERVAL_MS);
}

app.post('/upload-form', async (req, res) => {
    const {id, json_data} = req.body;

    const {error} = await supabase.from("forms").upsert(
        { id, json_data},
        { onConflict: "id" }, // on conflict update the row
        { Authorization: `Bearer ${USER_TOKEN}`}
    );

    if (error) {
        return res.status(500).send('Error saving data' + error.message);
    } else {
        res.send('Thank you for submitting your answers!');
    }
})

app.get('/get-form', async (req, res) => {
    const headers = req.headers;
    const id = headers.id;
    const {data, error} = await supabase
        .from("forms")
        .select("*")
        .eq("id", id) // only take rows where "id" = id

    if (error) {
        return res.status(500).send('Error fetching data' + error.message);
    } else {
        res.send(data);
    }
})

app.listen(PORT, () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
