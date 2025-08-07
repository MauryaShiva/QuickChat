import groq from "../lib/groq.js";

/**
 * An Express controller function to generate a user bio using the Groq AI API.
 * It takes keywords from the request body and returns a generated bio.
 * @param {object} request - The Express request object, containing the request body.
 * @param {object} response - The Express response object, used to send back the result.
 */
export const generateBio = async (request, response) => {
  try {
    // Destructures the 'keywords' property from the request body.
    const { keywords } = request.body;

    // Validates that the 'keywords' field is present in the request.
    if (!keywords) {
      return response
        .status(400)
        .json({ success: false, message: "Keywords are required." });
    }

    // Constructs a detailed prompt for the AI model, specifying the desired tone,
    // length, and format for the bio.
    const prompt = `Create a short, professional, and friendly bio for a chat app profile using these keywords: "${keywords}". Make it conversational, concise, and strictly under 160 characters. Important: Your response must contain ONLY the bio text itself, without any extra explanations, greetings, or character counts.`;

    // Sends the request to the Groq AI chat completions API.
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192",
    });

    // Extracts the generated bio text from the API response.
    // Provides a fallback message if the response is not in the expected format.
    const generatedBio =
      chatCompletion.choices[0]?.message?.content ||
      "Sorry, I couldn't generate a bio. Please try again.";

    // Sends a successful JSON response containing the generated bio.
    response.json({ success: true, bio: generatedBio });
  } catch (error) {
    // Catches any errors that occur during the API call or processing.
    console.error("Error generating bio:", error);
    response
      .status(500)
      .json({ success: false, message: "Failed to generate bio." });
  }
};
