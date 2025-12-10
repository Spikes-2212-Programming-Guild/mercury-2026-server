const express = require("express");
const app = express();
const https = require('https');
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

// keep alive loop
setInterval(() => {
    const url = "https://mercury-2026-server.onrender.com";
    return new Promise((resolve) => {
        const req = https.get(url, (res) => {
            if (res.statusCode === 200) {
                resolve({
                    statusCode: 200,
                    body: 'Server pinged successfully',
                });
                console.log('Server pinged successfully');
            } else {
                console.error('Server ping failed with status code: ', res.statusCode);
            }
        });

        req.end();
    });
}, 1000 * 60 * 5); // every 5 minutes

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
