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

async function GetSimilarJobTitles(jobTitle, limit = 5) {
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
    const { jobTitle, wordsToUse, wordsToAvoid, additionalInfo } = data;

    // Convert wordsToUse and wordsToAvoid from string to array if they are not already arrays
    const wordsToUseArray = Array.isArray(wordsToUse) ? wordsToUse : wordsToUse.split(',');
    const wordsToAvoidArray = Array.isArray(wordsToAvoid) ? wordsToAvoid : wordsToAvoid.split(',');


    // Get similar job titles
    const similarJobs = await GetSimilarJobTitles(jobTitle);
    console.log("Similar Jobs:", similarJobs); // Debugging line to inspect what is returned

    if (!similarJobs.length) {
        return "No similar job descriptions found.";
    }

    const similarJobsDetails = similarJobs.map(job => {
        return {
            Title: job.metadata.title || job.metadata.Title,
            Overview: job.metadata.description || job.metadata.JobDescription,
            Responsibilities: job.metadata.requirement || job.metadata.JobRequirment,
            Qualifications: job.metadata.qualification || job.metadata.RequiredQual
        };
    });
    console.log("Similar Jobs Details:", similarJobsDetails); // Verify mapped details

    // Creating a synthesized description for GPT to process
    const descriptions = similarJobsDetails.map(job => 
        `Title: ${job.Title}\nOverview: ${job.Overview}\nResponsibilities: ${job.Responsibilities}\nQualifications: ${job.Qualifications}`
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
            content: `Job Title: ${jobTitle}
            Words to use: ${wordsToUse.join(", ")}
            Words to avoid: ${wordsToAvoid.join(", ")}
            Additional Information: ${additionalInfo || 'None provided'}

            Similar job descriptions:
            ${descriptions}
            Use these similar job descriptions as inspiration, but create a unique and tailored description for the given role.`
        }
    ];
    
    const gptResponse = await gpt(messages, 0.6, "YemGPT4");
    console.log('GPT Response:', gptResponse);
    return gptResponse;

};


module.exports = {
    csvToJson,
    storeDataInPinecone,
    GetSimilarJobTitles,
    generateFinalJobDescription
}
