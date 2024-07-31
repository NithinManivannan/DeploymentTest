const { withRetries } = require('../Middleware/CallRetriesHelper');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

const client = new OpenAIClient(
    "https://yemgptswedenregion.openai.azure.com/",
    new AzureKeyCredential("bd23826ee13840539652a60eaa6a526b"));

async function gpt(messages, temperature = 0.5, modelName = "YemGPT35", throwError = false) {
    console.log('Start gpt function', { message: messages, temperature });
    try {
        const response = await client.getChatCompletions(
            modelName,
            messages,
            {
                temperature: temperature,
            }
        )

        const toReturn = response.choices[0].message.content;

        console.log('End gpt function successfully', { message: messages, temperature });
        return toReturn;
    } catch (error) {
        console.error('Error in gpt function', { error: error.message, message: messages, temperature });
        if (throwError) {
            throw error;
        } else {
            return null;
        }
    }
}

async function gpt35TurboInstruct(prompt, temperature = 0.7, throwError = false) {
    console.log('Start gpt35TurboInstruct function', { prompt, temperature });
    try {
        const response = await client.getCompletions(
            "YemGPT35TurboInstruct",
            prompt,
            {
                maxTokens: 2000,
                temperature: temperature,
            }
        )

        const toReturn = response.choices[0].text;

        console.log('End gpt35TurboInstruct function successfully', { prompt, temperature });
        return toReturn;
    } catch (error) {
        console.error('Error in gpt35TurboInstruct function', { error: error.message, prompt, temperature });
        if (throwError) {
            throw error;
        } else {
            return null;
        }
    }
}

async function getEmbeddings(texts) {
    try {
        const response = await client.getEmbeddings(
            "YemEmbedding",
            texts
        )
        

        console.log('Successfully got embeddings', { texts });
        return response.data.map(embedding => embedding.embedding);
    } catch (error) {
        console.error('Error in getEmbeddings function', { error: error.message, texts });
        return Array(texts.length).fill(null); // return an array of nulls with the same length as input
    }
}

async function getEmbedding(text) {
    try {

        const response = await client.getEmbeddings("YemEmbedding", [text]);
        console.log('Successfully got embedding', { text });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error in getEmbedding function', { error: error.message, text });
        return null;
    }
}


module.exports = {
    gpt,
    getEmbeddings,
    getEmbedding,
    gpt35TurboInstruct
}