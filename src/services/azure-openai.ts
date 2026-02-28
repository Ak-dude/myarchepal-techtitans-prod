interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

interface ImageAnalysisResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class AzureOpenAIService {
  private static config: AzureOpenAIConfig = {
    endpoint: import.meta.env.VITE_AZURE_OPENAI_ENDPOINT || '',
    apiKey: import.meta.env.VITE_AZURE_OPENAI_API_KEY || '',
    deploymentName: import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
    apiVersion: import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
  };

  // Convert file to base64 for API
  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  // Analyze uploaded artifact image
  static async analyzeArtifactImage(imageFile: File): Promise<string> {
    try {
      console.log('🔄 Starting AI image analysis...');
      console.log('Image file:', { name: imageFile.name, size: imageFile.size, type: imageFile.type });

      // Validate configuration
      if (!this.config.endpoint || !this.config.apiKey) {
        console.error('❌ Azure OpenAI configuration missing');
        throw new Error('Azure OpenAI configuration is not properly set up. Please check your environment variables.');
      }

      // Convert image to base64
      console.log('📸 Converting image to base64...');
      const base64Image = await this.fileToBase64(imageFile);

      // Construct API URL
      const url = `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;

      // Prepare the request payload
      const payload = {
  messages: [
    {
      role: 'system',
      content: `You are an expert archaeologist and scientific writer.
                Your task is to analyze an uploaded image of an archaeological artifact and produce a concise, professional summary of approximately 200 words, suitable for a museum catalog or excavation report.

                In your summary, you must:
                - Identify the object type and, when possible, its probable material, period, and cultural origin.
                - Describe key formal and stylistic features visible in the image (shape, proportions, decoration, inscriptions, manufacturing traces, wear patterns).
                - Comment on the preservation state and any visible damage or restoration.
                - Interpret the likely function and/or symbolic significance of the object.
                - Conclude with 1–2 research questions or hypotheses that could be explored further.

                Use a clear, factual, academic tone.
                If some aspects are ambiguous, use cautious phrasing such as "likely", "appears to", or "possibly", and do not invent details that cannot reasonably be inferred from the image.`
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Please analyze this archaeological artifact image and provide a ~200-word professional summary for our catalog:'
                        },
                        {
                          type: 'image_url',
                          image_url: {
                            url: `data:${imageFile.type};base64,${base64Image}`,
                            detail: 'high'
                          }
                        }
                      ]
                    }
                  ],
                  max_tokens: 500,
                  temperature: 0.3
                };


      console.log('🚀 Calling Azure OpenAI API...');

      // Make the API request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Azure OpenAI API error:', response.status, errorText);
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result: ImageAnalysisResponse = await response.json();
      console.log('✅ AI analysis completed');

      // Extract the summary from the response
      const summary = result.choices?.[0]?.message?.content;
      if (!summary) {
        throw new Error('No summary generated from AI analysis');
      }

      console.log('📋 Generated summary length:', summary.length);
      return summary;

    } catch (error: any) {
      console.error('❌ Error in AI image analysis:', error);

      // Provide fallback message instead of throwing error
      const fallbackMessage = `AI analysis unavailable for this image. Manual analysis recommended for: ${imageFile.name} (${imageFile.type}, ${Math.round(imageFile.size / 1024)}KB)`;
      console.log('⚠️ Using fallback summary:', fallbackMessage);
      return fallbackMessage;
    }
  }

  // Alternative method for when image is already uploaded to Firebase Storage
  static async analyzeArtifactImageFromUrl(imageUrl: string, artifactName: string): Promise<string> {
    try {
      console.log('🔄 Starting AI image analysis from URL...');

      if (!this.config.endpoint || !this.config.apiKey) {
        throw new Error('Azure OpenAI configuration is not properly set up');
      }

      const url = `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;

      const payload = {
        messages: [
          {
            role: 'system',
            content: 'You are an expert archaeologist. Analyze this artifact image and provide a concise professional summary for archaeological documentation (150-200 words).'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this archaeological artifact image for "${artifactName}":`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Azure OpenAI API error: ${response.status}`);
      }

      const result: ImageAnalysisResponse = await response.json();
      return result.choices?.[0]?.message?.content || 'AI analysis could not be generated';

    } catch (error: any) {
      console.error('Error in AI image analysis from URL:', error);
      return `AI analysis unavailable for ${artifactName}. Manual analysis recommended.`;
    }
  }

  // Analyze uploaded article image for content insights
  static async analyzeArticleImage(imageFile: File): Promise<string> {
    try {
      console.log('🔄 Starting AI article image analysis...');
      console.log('Image file:', { name: imageFile.name, size: imageFile.size, type: imageFile.type });

      // Validate configuration
      if (!this.config.endpoint || !this.config.apiKey) {
        console.error('❌ Azure OpenAI configuration missing');
        throw new Error('Azure OpenAI configuration is not properly set up. Please check your environment variables.');
      }

      // Convert image to base64
      console.log('📸 Converting image to base64...');
      const base64Image = await this.fileToBase64(imageFile);

      // Construct API URL
      const url = `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;

      // Prepare the request payload for article analysis
      const payload = {
        messages: [
          {
            role: 'system',
            content: `You are an expert archaeological researcher and scientific writer specializing in visual content analysis.
                      Your task is to analyze an uploaded image that will be used as the cover image for an archaeological article.

                      Provide a comprehensive analysis of approximately 150-200 words that includes:

                      - Visual description: Describe what is shown in the image (artifacts, sites, excavations, maps, diagrams, etc.)
                      - Archaeological context: Identify any visible archaeological features, periods, or cultural elements
                      - Research significance: Explain what this image contributes to archaeological knowledge or methodology
                      - Educational value: Comment on how this image supports the understanding of archaeological concepts
                      - Technical aspects: Note any special techniques, documentation methods, or analytical approaches visible

                      Use clear, engaging academic language suitable for a general scientific audience.
                      Focus on how this image enhances the understanding of archaeological research and findings.
                      If the image shows excavation work, artifacts, or sites, comment on their potential significance.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image that will be used as a cover image for an archaeological article. Provide insights about its content and archaeological significance:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageFile.type};base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      };

      console.log('🚀 Calling Azure OpenAI API for article image...');

      // Make the API request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Azure OpenAI API error:', response.status, errorText);
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result: ImageAnalysisResponse = await response.json();
      console.log('✅ AI article analysis completed');

      // Extract the summary from the response
      const summary = result.choices?.[0]?.message?.content;
      if (!summary) {
        throw new Error('No summary generated from AI analysis');
      }

      console.log('📋 Generated article image analysis length:', summary.length);
      return summary;

    } catch (error: any) {
      console.error('❌ Error in AI article image analysis:', error);

      // Provide fallback message instead of throwing error
      const fallbackMessage = `AI analysis unavailable for this image. This image appears to be related to archaeological research and would benefit from manual analysis and description. Image details: ${imageFile.name} (${imageFile.type}, ${Math.round(imageFile.size / 1024)}KB)`;
      console.log('⚠️ Using fallback summary:', fallbackMessage);
      return fallbackMessage;
    }
  }
}