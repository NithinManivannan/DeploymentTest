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

    for (const data of jsonData) {
        const embedding = await getEmbedding(data.Title);  // Only embed the job title
        const record = {
            id: data.Title,  // Use the job title as the ID
            values: embedding,
            metadata: {
                title: data.Title,
                description: data.JobDescription,
                requirement: data.JobRequirment,
                qualification: data.RequiredQual
            }
        };
        await writeVectors([record], "Title");
    }
}

// async function GetSimilarJobRoles(role) {
//     let jsonData = fs.readFileSync(outputJsonPath, 'utf8');
//     jsonData = JSON.parse(jsonData);

//     const response = await searchVector(role, "JOB POSTINGS", 10);

//     // get matching job roles
//     const jobRoles = [];
//     for (const result of response) {
//         const id = Number(result.id);
//         const jobRole = jsonData.find((record) => record.id === id);
//         jobRoles.push(jobRole);
//     }

//     return jobRoles;
// }

async function GetSimilarJobTitles(jobTitle, limit = 3) {
    try {
        console.log("Job title passed to getEmbedding:", jobTitle);
        const embedding = await getEmbedding(jobTitle);
        if (!embedding) {
            console.error('Failed to get embedding for job title');
            return [];
        }
        const response = await searchVector(embedding, "Title", limit);
        return response || [];
    } catch (error) {
        console.error('Error in GetSimilarJobTitles:', error);
        return [];
    }
}

const generateFinalJobDescription = async (data) => {
    const { jobRole, responsibilities, qualifications, recommendedWords, wordsToAvoid } = data;

    // Get similar job titles
    const similarJobs = await GetSimilarJobTitles(jobRole);

    const responsibilitiesStr = responsibilities.length > 0 ? responsibilities.join(", ") : "[No responsibilities listed]";
    const qualificationsStr = qualifications.length > 0 ? qualifications.join(", ") : "[No qualifications listed]";

    const similarJobsStr = similarJobs.map(job => 
        `Title: ${job.metadata.title}\nDescription: ${job.metadata.description}\nRequirements: ${job.metadata.requirement}\nQualifications: ${job.metadata.qualification}`
    ).join("\n\n");
        const messages = [
        {
            role: "system",
            content: `Generate a comprehensive job description. Use the provided information and similar job descriptions as inspiration. Ensure it includes necessary sections and is tailored to attract qualified candidates.

            Task:
            1. Analyze the similar job descriptions provided.
            2. Synthesize the input data and similar job descriptions to produce a well-organized job description.
            3. Ensure the description covers all critical aspects such as job title, responsibilities, qualifications, and company culture.

            Output should include:
            - Job Title
            - Overview (company and role description)
            - Responsibilities
            - Required Qualifications
            - Preferred Qualifications
            - Skills
            - Benefits
            - Application Process
            `
        },
        {
            role: "user",
            content: `Here is the role information: ${jobRole}.
            Responsibilities include: ${responsibilitiesStr}.
            Qualifications needed: ${qualificationsStr}.
            Encouraged to use these words: ${recommendedWords.join(", ")}.
            Avoid using these words: ${wordsToAvoid.join(", ")}.

            Similar job descriptions:
            ${similarJobsStr}

            Use these similar job descriptions as inspiration, but create a unique and tailored description for the given role.`
        }
    ];
    
    const gptResponse = await gpt(messages, 0.6, "YemGPT4");
    console.log('GPT Response:', gptResponse);
    return gptResponse;

    // const makeFinalJobDescription = async () => {
    //     const gptResponse = await gpt(messages, 0.6, "YemGPT4");
    //     console.log('GPT Response:', gptResponse);
    //     // Ensure the response is in the correct format
    //     try {
    //         const parsedResponse = JSON5.parse(gptResponse);
    //         if (parsedResponse && parsedResponse["Job Title"]) {
    //             return parsedResponse;
    //         } else {
    //             throw new Error("Invalid response format");
    //         }
    //     } catch (error) {
    //         console.error('Error parsing GPT response:', error);
    //         return {
    //             "Error": "Unable to generate job description. Please try again."
    //         };
    //     }
    // }

    // const finalJobDescription = await makeFinalJobDescription();
    // return finalJobDescription;
};


module.exports = {
    csvToJson,
    storeDataInPinecone,
    // GetSimilarJobRoles,
    generateFinalJobDescription,
    GetSimilarJobTitles
}
