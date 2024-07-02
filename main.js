const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { getEmbedding, gpt } = require('./APILayer/openai');
const { writeVectors, search2DaysOfVectors, searchVector } = require('./APILayer/pinecone');
const JSON5 = require('json5');


const filePath = path.join(__dirname, 'jd_training_dataset_0.csv'); // Adjusted file path to the current directory
const outputJsonPath = path.join(__dirname, 'postings.json'); // Output path in the current directory

function csvToJson() {
    const results = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            const json = JSON.stringify(results, null, 2); // Converts the result to JSON string format with pretty printing
            fs.writeFileSync(outputJsonPath, json, 'utf8'); // Write the JSON string to a file
            console.log('CSV file successfully processed and JSON saved.');
        })
        .on('error', (error) => {
            console.error('Error processing CSV file:', error.message);
        });
}

async function storeDataInPinecone() {
    let jsonData = fs.readFileSync(outputJsonPath, 'utf8');
    jsonData = JSON.parse(jsonData);

    // //add an id field to each record
    // for (let i = 0; i < jsonData.length; i++) {
    //     jsonData[i].id = i;
    // }

    // // store this back in the outputJsonPath
    // fs.writeFileSync(outputJsonPath, JSON.stringify(jsonData), 'utf8');

    for (const data of jsonData) {
        const embedding = await getEmbedding(JSON.stringify(data));

        const record = {
            id: `${data.id}`,
            values: embedding,
            metadata: {
                id: `${data.id}`
            }
        };

        await writeVectors([record], "JOB POSTINGS");
    }
}

async function GetSimilarJobRoles(role) {
    let jsonData = fs.readFileSync(outputJsonPath, 'utf8');
    jsonData = JSON.parse(jsonData);

    const response = await searchVector(role, "JOB POSTINGS", 10);

    // get matching job roles
    const jobRoles = [];
    for (const result of response) {
        const id = Number(result.id);
        const jobRole = jsonData.find((record) => record.id === id);
        jobRoles.push(jobRole);
    }

    return jobRoles;
}

async function GetDataForJobPosting(targetRole, similarJobRoles) {
    const messages = [
        {
            role: "system",
            content: `Your job is to analyze job postings and identify key data points needed to create a new comprehensive job posting. The user is a recruiter whose job is to make effective job postings and get good, quick hires. The user will provide sample job postings from their company and the current role they are looking to make a job posting for.
            
            Based on the provided job postings, please:
            1. Identify the key data points required to create a comprehensive job posting.
            2. Auto-fill the key data points based on the provided sample job postings.
            3. Generate any questions that need to be asked to gather missing or additional information necessary to create a new job posting.
            
            Please provide the output in the following format:
            {
                "Key Data Points": ["data point 1", "data point 2"],
                "Auto-Filled Data": {
                    "data point 1": "value 1",
                    "data point 2": "value 2"
                },
                "Questions for Job Creator": ["question 1", "question 2"]
            }`
        },
        {
            role: "user",
            content: `
            This is the role I am trying to make a job posting for: ${targetRole}.
            Here are the similar roles in my company: ${JSON.stringify(similarJobRoles)}.`
        }
    ];

    const makeCondensedUpdate = async () => {
        const gptResponse = await gpt(messages, 0.6, "YemGPT4");
        const parsedResponse = JSON5.parse(gptResponse);
        return parsedResponse;
    }

    const condensedUpdate = await makeCondensedUpdate();
    return condensedUpdate;
}

const generateFinalJobDescription = async (jobRole, autoFilledData, answers) => {
    const messages = [
        {
            role: "system",
            content: `Your task is to create a comprehensive job description. The user is a recruiter whose job is to make effective job postings and get good, quick hires. The user will provide the job role they are looking to make a job posting for, auto-filled data, and additional answers from the job creator.
            
            Based on the provided information, please:
            1. Combine the job role, auto-filled data, and additional answers to create a comprehensive job description.
            2. Ensure the job description is detailed, professional, and enticing for potential candidates.
            
            Please provide the output in a JSON FORMAT with the necessary key value pairs for a job description.
            
            EXAMPLE:
            {
                "Job Title": "Job Title Here",
                "Job Salary": "Salary Range Here",
                "Experience Required": "Experience Details Here",
                "Responsibilities": "Responsibilities Here",
                "Qualifications": "Qualifications Here",
                "Benefits": "Benefits Here",
                etc...
            }`
        },
        {
            role: "user",
            content: `
            This is the role I am trying to make a job posting for: ${jobRole}.
            Here is the auto-filled data: ${JSON.stringify(autoFilledData, null, 2)}.
            Here are the additional answers: ${JSON.stringify(answers, null, 2)}.`
        }
    ];

    const makeFinalJobDescription = async () => {
        const gptResponse = await gpt(messages, 0.6, "YemGPT4");

        // Ensure the response is in the correct format
        try {
            const parsedResponse = JSON5.parse(gptResponse);
            if (parsedResponse && parsedResponse["Job Title"]) {
                return parsedResponse;
            } else {
                throw new Error("Invalid response format");
            }
        } catch (error) {
            console.error('Error parsing GPT response:', error);
            return {
                "Error": "Unable to generate job description. Please try again."
            };
        }
    }

    const finalJobDescription = await makeFinalJobDescription();
    return finalJobDescription;
};

module.exports = {
    csvToJson,
    storeDataInPinecone,
    GetSimilarJobRoles,
    GetDataForJobPosting,
    generateFinalJobDescription
}
