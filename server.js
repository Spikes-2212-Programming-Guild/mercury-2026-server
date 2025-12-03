const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3000;
const {createClient} = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());

async function login(email, password) {

    const {user, session, error} = await supabase.auth.signInWithPassword({
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
