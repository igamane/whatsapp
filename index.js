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

const getAssistantResponse = async function(prompt) {
    const thread = await openai.beta.threads.create();

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

    const checkStatusAndPrintMessages = async (threadId, runId) => {
        let runStatus;
        while (true) {
            runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
            if (runStatus.status === "completed") {
                break; // Exit the loop if the run status is completed
            }
            console.log("Run is not completed yet.");
            await delay(1000); // Wait for 1 second before checking again
        }
        let messages = await openai.beta.threads.messages.list(threadId);
        return messages.data[0].content[0].text.value
    };
  
    function delay(ms) {
      return new Promise((resolve) => {
          setTimeout(resolve, ms);
      });
    }
  
    // Call checkStatusAndPrintMessages function
    checkStatusAndPrintMessages(thread.id, run.id);

} 

app.post("/webhook", (req, res) => { // I want some [text cut off]    
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

            let assistantResponse = getAssistantResponse(msg_body);

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