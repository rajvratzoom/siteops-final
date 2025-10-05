require('dotenv').config({ path: '.env.local' });

async function listModels() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('GEMINI_API_KEY not found in .env.local');
      return;
    }
    
    console.log('Fetching available models...\n');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('Available models:');
    console.log('='.repeat(70));
    
    for (const model of data.models || []) {
      console.log(`\nModel: ${model.name}`);
      console.log(`Display Name: ${model.displayName || 'N/A'}`);
      console.log(`Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('\nModels that support generateContent:');
    const contentModels = (data.models || []).filter(m => 
      m.supportedGenerationMethods?.includes('generateContent')
    );
    contentModels.forEach(m => console.log(`  - ${m.name.replace('models/', '')}`));
    
  } catch (error) {
    console.error('Error listing models:', error.message);
  }
}

listModels();