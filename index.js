const express = require("express");
const body_parser = require("body-parser");
const axios = require("axios");
const OpenAI = require("openai");

require("dotenv").config();

const app = express().use(body_parser.json());

const token = process.env.TOKEN;
const mytoken = process.env.MYTOKEN
const apiKey = process.env.OPENAI_API_KEY
const assistantId = process.env.ASSISTANT_ID

const openai = new OpenAI({
    apiKey: apiKey, // Replace with your OpenAI API key
});

const imageUrls = [
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344722/PHOTO-2021-10-19-10-47-56_drwkuk.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344722/PHOTO-2021-10-19-10-47-56_2_soq39w.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344722/PHOTO-2021-10-19-10-47-56_1_dvdnc4.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344722/PHOTO-2021-10-19-10-47-56_3_g2miyt.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_4_mvznw7.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_5_nixozh.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_8_bbzozr.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_6_iijfw5.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_7_yca55k.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_9_cxiuul.jpg'
];

const mapUrl = 'https://maps.app.goo.gl/4k8YVGdaEBsiKntL8?g_st=ic';


app.listen(8000||process.env.PORT, () => {
    console.log("webhook is listening");
});


app.get("/webhook", (req, res) => {
    let mode = req.query["hub.mode"];
    let challenge = req.query["hub.challenge"];
    let token = req.query["hub.verify_token"];
    
    if (mode && token) {
        console.log("&");
        if (mode === "subscribe" && token === mytoken) {
            console.log("hello get");
            res.status(200).send(challenge);
        } else {
            res.status(403);
        }
    }
});

const sendMultipleImages = async (phone_no_id, token, recipientNumber) => {
    for (const imageUrl of imageUrls) {
        try {
            await axios({
                method: "POST",
                url: `https://graph.facebook.com/v13.0/${phone_no_id}/messages?access_token=${token}`,
                data: {
                    messaging_product: "whatsapp",
                    to: recipientNumber,
                    type: "image",
                    image: {
                        link: imageUrl
                    }
                },
                headers: {
                    "Content-Type": "application/json"
                }
            });
            console.log(`Message sent successfully: Image URL - ${imageUrl}`);
        } catch (error) {
            console.error(`Error sending image ${imageUrl}:`, error);
            // Logging the error for the specific image URL
            console.error(`Error sending image ${imageUrl}:`, error);
        }
    }
    return('the images have been sent successfully, inform the client that you have sent the property images to take a look')
}

// await sendMultipleImages(phone_no_id, token, from);

const sendMapUrl = async (phone_no_id, token, recipientNumber, mapUrl) => {
    try {
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v13.0/${phone_no_id}/messages?access_token=${token}`,
            data: {
                messaging_product: "whatsapp",
                to: recipientNumber,
                type: "text",
                text: {
                    preview_url: true, // Enable link preview
                    body: mapUrl // The URL you want to send
                }
            },
            headers: {
                "Content-Type": "application/json"
            }
        });
        console.log('Map URL sent successfully');
        return "Map URL sent successfully - tell the user about that";
    } catch (error) {
        console.error('Error sending map URL:', error);
    }
};

// await sendMapUrl(phone_no_id, from, token, mapUrl)

const getAssistantResponse = async function(prompt, phone_no_id, token, recipientNumber) {
    const thread = await openai.beta.threads.create();

    console.log(thread.id);
    
    const message = await openai.beta.threads.messages.create(
        thread.id,
        {
            role: "user",
            content: prompt
        }
        );
        
        const run = await openai.beta.threads.runs.create(
            thread.id,
            { 
                assistant_id: assistantId,
            }
            );
            
    console.log(run.id);
    const checkStatusAndPrintMessages = async (threadId, runId) => {
        let runStatus;
        while (true) {
            runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
            console.log(runStatus.status);
            if (runStatus.status === "completed") {
                break; // Exit the loop if the run status is completed
            } else if (runStatus.status === 'requires_action') {
                console.log("Requires action");
            
                const requiredActions = runStatus.required_action.submit_tool_outputs.tool_calls;
                console.log(requiredActions);

                // Dispatch table
                const dispatchTable = {
                    "sendMultipleImages": sendMultipleImages,
                    "sendMapUrl": sendMapUrl
                };
            
                let toolsOutput = [];
            
                for (const action of requiredActions) {
                    const funcName = action.function.name;

                    if (dispatchTable[funcName]) {
                        try {
                            const output = await dispatchTable[funcName](phone_no_id, token, recipientNumber, ...Object.values(functionArguments));
                            toolsOutput.push({ tool_call_id: action.id, output: JSON.stringify(output) });
                        } catch (error) {
                            console.log(`Error executing function ${funcName}: ${error}`);
                        }
                    } else {
                        console.log("Function not found");
                    }
                    
                    // if (funcName === "sendMultipleImages") {
                    //     const output = await sendMultipleImages(phone_no_id, token, recipientNumber);
                    //     toolsOutput.push({
                    //         tool_call_id: action.id,
                    //         output: JSON.stringify(output)  
                    //     });
                    // } else if (funcName === "sendMapUrl") {
                    //     const output = await sendMapUrl(phone_no_id, recipientNumber, token, mapUrl);
                    //     toolsOutput.push({
                    //         tool_call_id: action.id,
                    //         output: JSON.stringify(output)  
                    //     });
                    // } 
                }
            
                // Submit the tool outputs to Assistant API
                await openai.beta.threads.runs.submitToolOutputs(
                    thread.id,
                    run.id,
                    { tool_outputs: toolsOutput }
                );
            } 
            console.log("Run is not completed yet.");
            await delay(1000); // Wait for 1 second before checking again
        } 
        let messages = await openai.beta.threads.messages.list(threadId);
        console.log("messages", messages)
        return messages.data[0].content[0].text.value
    };
  
    function delay(ms) {
      return new Promise((resolve) => {
          setTimeout(resolve, ms);
      });
    }
  
    // Call checkStatusAndPrintMessages function
    return await checkStatusAndPrintMessages(thread.id, run.id);

} 
// const getAssistantResponse = async function(prompt) {
//     const thread = await openai.beta.threads.create();

//     console.log(thread.id);
    
//     const message = await openai.beta.threads.messages.create(
//         thread.id,
//         {
//             role: "user",
//             content: prompt
//         }
//         );
        
//         const run = await openai.beta.threads.runs.create(
//             thread.id,
//             { 
//                 assistant_id: assistantId,
//             }
//             );
            
//     console.log(run.id);
//     const checkStatusAndPrintMessages = async (threadId, runId) => {
//         let runStatus;
//         while (true) {
//             runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
//             console.log(runStatus.status);
//             if (runStatus.status === "completed") {
//                 break; // Exit the loop if the run status is completed
//             }
//             console.log("Run is not completed yet.");
//             await delay(1000); // Wait for 1 second before checking again
//         }
//         let messages = await openai.beta.threads.messages.list(threadId);
//         console.log("messages", messages)
//         return messages.data[0].content[0].text.value
//     };
  
//     function delay(ms) {
//       return new Promise((resolve) => {
//           setTimeout(resolve, ms);
//       });
//     }
  
//     // Call checkStatusAndPrintMessages function
//     return await checkStatusAndPrintMessages(thread.id, run.id);

// } 

app.post("/webhook", async (req, res) => { // I want some [text cut off]    
    let body_param = req.body;
    
    console.log(JSON.stringify(body_param, null, 2));
    
    if(body_param.object){
        if(body_param.entry &&
           body_param.entry[0].changes &&
           body_param.entry[0].changes[0].value.messages &&
           body_param.entry[0].changes[0].value.messages[0]
        ){
            let phone_no_id = body_param.entry[0].changes[0].value.metadata.phone_number_id;
            let from = body_param.entry[0].changes[0].value.messages[0].from;
            let msg_body = body_param.entry[0].changes[0].value.messages[0].text.body;

            let assistantResponse = await getAssistantResponse(msg_body, phone_no_id, token, from);

            console.log("assistantR?esponse", assistantResponse);

            
            

            axios({
                method: "POST",
                url: "https://graph.facebook.com/v13.0/" + phone_no_id + "/messages?access_token=" + token,
                data: {
                    messaging_product: "whatsapp",
                    to: from,
                    text: {
                        body: assistantResponse
                    }
                },
                headers: {
                    "Content-Type": "application/json"
                }
            });
            
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
            
    }
    // Additional code may be needed here to complete the response
});

app.get("/", (req, res) =>{
    res.status(200).send("hello bro");
})