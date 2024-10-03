document.getElementById("call-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const firstName = document.getElementById("first-name").value;
        const phoneNumber = document.getElementById("phone-number").value;
        const prompt = document.getElementById("prompt").value;

        const options = {
          method: "POST",
          headers: {
            Authorization: "Bearer 9f9ef4ba-5978-456f-a9b5-26bdde7d1ea2",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `Call with ${firstName}`,
            phoneNumberId: "5fb5c471-da97-4c67-a102-0ee3a91e1250",
            customer: {
              number: phoneNumber
            },
            assistant: {
              firstMessage: `Hi ${firstName}, ${prompt}`,
              transcriber: {
                provider: "deepgram",
                model: "nova-2",
                language: "en-AU",
                smartFormat: false,
              },
              model: {
                provider: "openai", // Ensure the provider is correctly set up
                model: "gpt-4",
                messages: [
                  {
                    role: "system",
                    content: prompt
                  }
                ],
                knowledgeBase: {
                  provider: "canonical",
                  fileIds: ["your-file-id"] // Add the actual file ID(s) here
                },
              },
            },
          }),
        };

        fetch("https://api.vapi.ai/call", options)
          .then((response) => response.json())
          .then((response) => console.log(response))
          .catch((err) => console.error(err));
      });