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

const formCache = {};
const CACHE_TTL = 5 * 60 * 1000;

function setCache(id, data) {
    formCache[id] = {
        ...data,
        expiresAt: Date.now() + CACHE_TTL
    };
}

function getCache(id) {
    const entry = formCache[id];
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        delete formCache[id];
        return null;
    }
    return entry;
}

/*
    TODO:
     1. once in a while, send an empty request to the db, to reduce downtime
     2. change the method names
     3. add helper methods (getCurrentFormVersion, isId / version valid...)

    get:
     1. the form id and version
     2. a JSON of key-value (possible to make it without the key, and just ordered...)

 */
app.post('/upload-submission', async (req, res) => {
    const { form_id, form_version, submission } = req.body;

    if (!form_id || !submission || !form_version) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const { error } = await supabase
        .from("submissions")
        .insert({form_id, form_version, submission});

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.sendStatus(201);
});

app.post('/upload-form', async (req, res) => {
    const { id, form, version } = req.body;

    if (!id || typeof version !== "number") {
        return res.status(400).json({ error: "Invalid request, make sure version is a number" });
    }

    // fetch current version
    const { data, error } = await supabase
        .from("forms")
        .select("version")
        .eq("id", id)
        .single();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // make a new form if form doesn't exist
    if (!data) {
        const { error: insertError } = await supabase
            .from("forms")
            .insert({
                id,
                form,
                version: 1
            });

        if (insertError) {
            return res.status(500).json({ error: insertError.message });
        }

        return res.status(201).json({ version: 1 });
    }

    // if version conflict, send the latest version
    if (data.version !== version) {
        return res.status(409).json({
            currentVersion: data.version
        });
    }

    // update the version
    const newVersion = version + 1;
    setCache(id, {form, version: newVersion})

    const { error: updateError } = await supabase
        .from("forms")
        .update({
            form,
            version: newVersion,
        })
        .eq("id", id);

    if (updateError) {
        return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ version: newVersion });
});

app.get('/get-form/:id/:version', async (req, res) =>   {
    const { id, version } = req.params;
    const clientVersion = Number(version);

    const cache = getCache(id);
    if (cache) {

        if (cache.version === clientVersion) {
            console.log("not modified");
            return res.sendStatus(304);
        }

        console.log("serving from cache")
        return res.status(200).json({
            form: cache.form,
            version: cache.version
        })
    }

    // fetch version
    console.time("request");
    const { data, error } = await supabase
        .from("forms")
        .select("form, version")
        .eq("id", id)
        .single();
    console.timeEnd("request");

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    if (!data) {
        return res.sendStatus(404);
    }

    setCache(id, {
        form: data.form,
        version: data.version
    });

    if (data.version === clientVersion) {
        return res.sendStatus(304);
    }

    console.log(data.version)

    return res.status(200).json({
        form: data.form,
        version: data.version
    });
})

app.listen(PORT, () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
