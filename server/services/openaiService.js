const { OpenAI } = require('openai');
const { parse, format, isValid, set } = require('date-fns');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.processTranscript = async (transcript) => {
    console.log('Transcript to be processed:', transcript);
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: "Extract the following information from the transcript: name, email, phone number, date (in dd MMMM format), and time (in HH:mm 24-hour format). Format the output as JSON." },
            { role: "user", content: transcript }
        ],
    });

    // console.log('OpenAI response:', response);

    const responseContent = response.choices[0].message.content;
    // console.log('Response Content:', responseContent);

    let extractedInfo = {};

    try {
        extractedInfo = JSON.parse(responseContent);

        if (!extractedInfo || typeof extractedInfo !== 'object') {
            throw new Error('Failed to parse JSON');
        }

        extractedInfo = {
            name: extractedInfo.name || null,
            email: extractedInfo.email || null,
            phone: extractedInfo.phone || null,
            date: extractedInfo.date ? processDate(extractedInfo.date) : null,
            time: extractedInfo.time ? processTime(extractedInfo.time) : null
        };

    } catch (error) {
        console.error('Error extracting info from OpenAI response:', error);
        
        const nameMatch = responseContent.match(/Name:\s*([^\n]+)/i);
        const emailMatch = responseContent.match(/Email:\s*([^\n]+)/i);
        const phoneMatch = responseContent.match(/Phone:\s*([^\n]+)/i);
        const dateMatch = responseContent.match(/Date:\s*([^\n]+)/i);
        const timeMatch = responseContent.match(/Time:\s*([^\n]+)/i);

        extractedInfo = {
            name: nameMatch ? nameMatch[1].trim() : null,
            email: emailMatch ? emailMatch[1].trim() : null,
            phone: phoneMatch ? phoneMatch[1].trim() : null,
            date: dateMatch ? processDate(dateMatch[1].trim()) : null,
            time: timeMatch ? processTime(timeMatch[1].trim()) : null
        };
    }

    // console.log('Extracted info from OpenAI:', extractedInfo);
    return extractedInfo;
};

function processDate(dateString) {
    const currentYear = new Date().getFullYear();
    let parsedDate;

    const formats = ['dd MMMM', 'dd MMMM yyyy', 'MMMM dd', 'MMMM dd, yyyy'];
    for (const formatString of formats) {
        parsedDate = parse(dateString, formatString, new Date(currentYear, 0, 1));
        if (isValid(parsedDate)) break;
    }

    if (isValid(parsedDate)) {
        // Always set the year to the current year
        parsedDate = set(parsedDate, { year: currentYear });
        return format(parsedDate, 'yyyy/MM/dd');
    }

    return null;
}

function processTime(timeString) {
    let parsedTime = parse(timeString, 'HH:mm', new Date());
    if (!isValid(parsedTime)) {
        parsedTime = parse(timeString, 'h:mm a', new Date());
    }
    return isValid(parsedTime) ? format(parsedTime, 'HH:mm') : null;
}