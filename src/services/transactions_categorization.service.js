const DB = require("../connect");

let categories = [];

async function init() {
    const DBCategories = await DB.query("SELECT nombre_categ FROM categoria");
    const parsedCategories = DBCategories.rows.map((DBCategory) => DBCategory.nombre_categ);
    categories = parsedCategories;
}

// TODO: Add JSDoc
async function AI(transaction) {
    const request = new Request("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: process.env.OLLAMA_MODEL,
            prompt: `Categorize the following transaction using the following categories.
                You may create a new category if you consider necessary.
                Transaction:
                Date: ${transaction.date}
                Description: ${transaction.description}
                Type: ${transaction.type}
                Amount: ${transaction.amount}
                Available categories: ${categories}
                Remember, you may create a new category if necessary, but consider using the already existing ones.
                Output a JSON in spanish. JSON should be as follows: { category: string }.
                If using an already existing category, output it EXACTLY as it is provided.`,
            think: true,
            stream: false,
            format: {
                type: "object",
                category: { type: "string" },
                required: ["category"]
            },
            options: {
                temperature: 0.1
            }
        })
    })
    const response = await fetch(request);
    const json = await response.json();
    // TODO: Fallback if model error
    const category = JSON.parse(json.response).category;
    // TODO: Add new category to DB
    if (!categories.includes(category)) categories.push(category);
    return category;
}

init();

module.exports = AI;