const express = require("express");
const app = express();
const cors = require("cors");
const {createClient} = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3000;
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

app.use(cors());
app.use(express.json({ limit: '50kb' }));

if (process.env.RENDER) { // if it runs on render (and not locally)
    const APP_URL = process.env.RENDER_EXTERNAL_URL;
    const INTERVAL_MS = 14 * 60 * 1000; // ping every 14 minutes

    async function ping() {
        await fetch(APP_URL); // ping the server (don't care for the response)
        console.log(`${new Date().toISOString()}: Pinged the server`);
    }

    setInterval(ping, INTERVAL_MS);
}

/*
    TODO:
     1. maybe add ttl for safety
 */

const formCache = {};

app.post('/upload-form', async (req, res) => {
    const {id, form} = req.body;

    if (form === formCache[id]) {
        console.log("form unchanged, skipping")
        return res.status(204).end();
    }

    formCache[id] = form; // cache the form

    console.time("request");
    const {error} = await supabase
        .from("forms")
        .upsert(
            { id, form },
            { onConflict: "id" }, // on conflict update the row
        );
    console.timeEnd("request");

    if (error) {
        return res.status(500).json({ error: error.message }).end();
    }

    res.status(204).end();
})

app.get('/get-form/:id', async (req, res) => {
    const { id } = req.params;

    if (formCache[id]) {
        console.log("serving from cache")
        return res.json(formCache[id]);
    }

    console.time("request");
    const { data, error } = await supabase
        .from("forms")
        .select("form")
        .eq("id", id)
        .single();
    console.timeEnd("request");

    if (error) {
        return res.status(500).send('Error fetching data' + error.message).end();
    }

    if (!data || !data.form) {
        return res.status(404).json(null).end();
    }

    const form = data.form;

    formCache[id] = form; // cache the form
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(form);
    return res.end();
})

app.listen(PORT, () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
