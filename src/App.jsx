import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Users, BookOpen, Loader2, AlertCircle, Download, Eye, Trash2, Moon, Sun, Edit3, Play, X, Zap, Clock, CheckCircle } from 'lucide-react';

const WannaListenApp = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [bookContent, setBookContent] = useState('');
  const [uploadMethod, setUploadMethod] = useState('file'); // Changed from 'text' to 'file'
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [characters, setCharacters] = useState([]);
  const [rawResults, setRawResults] = useState(null);
  const [error, setError] = useState('');
  const [chunks, setChunks] = useState([]);
  const [taggedChunks, setTaggedChunks] = useState([]);
  const [apiCalls, setApiCalls] = useState([]);
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showTestModal, setShowTestModal] = useState(false);
  const [testModalData, setTestModalData] = useState({ name: '', dialogueSample: '', voiceId: '' });
  const [emotionProgress, setEmotionProgress] = useState({ 
    current: 0, 
    total: 0, 
    currentChunk: '',
    estimatedTimeRemaining: 0,
    startTime: null,
    completedChunks: []
  });
  const [showEmotionProgress, setShowEmotionProgress] = useState(false);
  const fileInputRef = useRef(null);

  const API_BASE = 'https://experimentals.impromptu-labs.com/api_tools';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer f6b6dd9ed77bcbd92045056c7ce2a84b',
    'X-Generated-App-ID': '74287164-3407-42c5-b6f8-55eb5c086132',
    'X-Usage-Key': '0fa26870b41300015380dbc86f77204b'
  };

  // Auto-start processing when step changes to 2
  useEffect(() => {
    if (currentStep === 2 && bookContent.trim() && !processing) {
      processBook();
    }
  }, [currentStep]);

  const logApiCall = (endpoint, method, payload, response) => {
    const call = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      payload,
      response,
      id: Date.now()
    };
    setApiCalls(prev => [...prev, call]);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setBookContent(e.target.result);
      setCurrentStep(2);
    };
    reader.readAsText(file);
  };

  const chunkText = (text) => {
    const words = text.split(/\s+/);
    const totalWords = words.length;
    
    if (totalWords <= 10000) {
      return [text];
    }

    const chunks = [];
    const chunkSize = 10000;
    let currentChunk = [];
    let wordCount = 0;

    const paragraphs = text.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      const paragraphWords = paragraph.split(/\s+/).length;
      
      if (wordCount + paragraphWords > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n\n'));
        currentChunk = [paragraph];
        wordCount = paragraphWords;
      } else {
        currentChunk.push(paragraph);
        wordCount += paragraphWords;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
    }
    
    return chunks;
  };

  // Updated function to create much smaller chunks for emotion tagging to avoid timeouts
  const chunkTextForEmotionTagging = (text) => {
    const words = text.split(/\s+/);
    const totalWords = words.length;
    
    // Use much smaller chunks to avoid API timeouts (300-400 words max)
    const maxChunkSize = 350;
    
    if (totalWords <= maxChunkSize) {
      return [text];
    }

    const chunks = [];
    let currentChunk = [];
    let wordCount = 0;

    // Split by sentences first to maintain natural breaks
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;
      
      // If adding this sentence would exceed the limit and we have content
      if (wordCount + sentenceWords > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [sentence];
        wordCount = sentenceWords;
      } else {
        currentChunk.push(sentence);
        wordCount += sentenceWords;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }
    
    return chunks;
  };

  const processBook = async () => {
    if (!bookContent.trim()) {
      setError('Please provide book content');
      return;
    }

    setProcessing(true);
    setError('');
    setCharacters([]);
    setRawResults(null);

    try {
      setProcessingStep('Chunking book into manageable sections...');
      const bookChunks = chunkText(bookContent);
      setChunks(bookChunks);

      setProcessingStep('Ingesting book content...');
      const ingestPayload = {
        created_object_name: 'book_chunks',
        data_type: 'strings',
        input_data: bookChunks
      };
      
      const ingestResponse = await fetch(`${API_BASE}/input_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ingestPayload)
      });
      const ingestResult = await ingestResponse.json();
      logApiCall('/input_data', 'POST', ingestPayload, ingestResult);

      setProcessingStep('Identifying characters and dialogue...');
      const extractPayload = {
        created_object_names: ['character_extractions'],
        prompt_string: `Analyze this text chunk and identify all speaking characters and narrator elements: {book_chunks}

For each speaking character found, extract:
- Character name (or description if unnamed)
- Gender (male/female/non-binary/unknown)
- Estimated age range (child/teen/young adult/middle-aged/elderly/unknown)
- Nationality/accent (if determinable from dialogue or description)
- Personality traits (based on speech patterns and described behavior)
- Representative dialogue sample (1-2 sentences that show their voice)
- Story relevance (main/supporting/minor)

For the narrator, analyze as a character with:
- Name: "Narrator"
- Gender (inferred from narrative voice and style)
- Age range (inferred from narrative maturity and perspective)
- Nationality/accent (inferred from narrative language patterns)
- Personality traits (narrative tone, formality, emotional range)
- Representative sample (1-2 sentences of narrative text)
- Story relevance: "narrator"

Return as JSON format:
{
  "characters": [
    {
      "name": "Character Name",
      "gender": "gender",
      "age_range": "age range", 
      "nationality": "nationality/accent",
      "personality": "personality description",
      "dialogue_sample": "sample dialogue or narrative",
      "story_relevance": "main/supporting/minor/narrator",
      "fish_audio_voice_id": ""
    }
  ]
}`,
        inputs: [{
          input_object_name: 'book_chunks',
          mode: 'use_individually'
        }]
      };

      const extractResponse = await fetch(`${API_BASE}/apply_prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify(extractPayload)
      });
      const extractResult = await extractResponse.json();
      logApiCall('/apply_prompt', 'POST', extractPayload, extractResult);

      setProcessingStep('Consolidating character profiles...');
      const consolidatePayload = {
        created_object_names: ['final_characters'],
        prompt_string: `Consolidate these character extractions from different book chunks: {character_extractions}

Merge duplicate characters (same person appearing in multiple chunks) and create a comprehensive character list. For each unique character, provide:
- Most complete name available
- Consistent gender identification
- Most specific age range
- Best nationality/accent determination
- Comprehensive personality description
- Best representative dialogue sample
- Story relevance ranking (main/supporting/minor based on frequency and importance)
- Empty fish_audio_voice_id field for user input

For the narrator, consolidate all narrator analysis into a single "Narrator" character entry with:
- Name: "Narrator"
- Consistent gender, age, nationality, personality analysis
- Best representative narrative sample
- Story relevance: "narrator"
- Empty fish_audio_voice_id field for user input

Sort characters by story relevance (narrator first, then main characters, then supporting, then minor).

Return as clean JSON:
{
  "characters": [
    {
      "name": "Character Name",
      "gender": "gender",
      "age_range": "age range", 
      "nationality": "nationality/accent",
      "personality": "personality description",
      "dialogue_sample": "sample dialogue or narrative",
      "story_relevance": "main/supporting/minor/narrator",
      "fish_audio_voice_id": ""
    }
  ]
}`,
        inputs: [{
          input_object_name: 'character_extractions',
          mode: 'combine_events'
        }]
      };

      const consolidateResponse = await fetch(`${API_BASE}/apply_prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify(consolidatePayload)
      });
      const consolidateResult = await consolidateResponse.json();
      logApiCall('/apply_prompt', 'POST', consolidatePayload, consolidateResult);

      setProcessingStep('Formatting results...');
      const returnPayload = {
        object_name: 'final_characters',
        return_type: 'json'
      };

      const response = await fetch(`${API_BASE}/return_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(returnPayload)
      });

      const result = await response.json();
      logApiCall('/return_data', 'POST', returnPayload, result);
      
      console.log('Raw API result:', result);
      
      // Fixed parsing logic
      let parsedData = null;
      
      if (result.value) {
        // Check if result.value is already the parsed object we need
        if (result.value.characters) {
          parsedData = result.value;
        }
        // Check if result.value is an array (old format)
        else if (Array.isArray(result.value)) {
          for (const item of result.value) {
            try {
              // Try to parse if it's a string
              if (typeof item === 'string') {
                const parsed = JSON.parse(item);
                if (parsed.characters) {
                  parsedData = parsed;
                  break;
                }
              }
              // If it's already an object, check if it has the expected structure
              else if (item && typeof item === 'object') {
                if (item.characters) {
                  parsedData = item;
                  break;
                }
              }
            } catch (e) {
              console.log('Parse attempt failed for item:', item, e);
              continue;
            }
          }
        }
        // Try to parse result.value as a string
        else if (typeof result.value === 'string') {
          try {
            const parsed = JSON.parse(result.value);
            if (parsed.characters) {
              parsedData = parsed;
            }
          } catch (e) {
            console.log('Could not parse result.value as JSON string:', e);
          }
        }
      }
      
      console.log('Parsed data:', parsedData);
      
      if (parsedData && parsedData.characters) {
        // Ensure each character has a fish_audio_voice_id field
        const charactersWithVoiceId = parsedData.characters.map(char => ({
          ...char,
          fish_audio_voice_id: char.fish_audio_voice_id || ''
        }));
        
        const updatedData = { ...parsedData, characters: charactersWithVoiceId };
        setRawResults(updatedData);
        setCharacters(charactersWithVoiceId);
        setCurrentStep(3);
      } else {
        throw new Error('Could not find valid character data in response. Check API details for more information.');
      }

      setProcessingStep('Complete!');
    } catch (err) {
      setError(`Processing error: ${err.message}`);
      console.error('Error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const processEmotionTags = async () => {
    if (!bookContent.trim()) {
      setError('No book content available for emotion tagging');
      return;
    }

    setProcessing(true);
    setShowEmotionProgress(true);
    setError('');
    setTaggedChunks([]);
    
    const startTime = Date.now();
    setEmotionProgress({ 
      current: 0, 
      total: 0, 
      currentChunk: '',
      estimatedTimeRemaining: 0,
      startTime,
      completedChunks: []
    });

    try {
      setProcessingStep('Creating small chunks for emotion tagging...');
      
      // Create much smaller chunks to avoid API timeouts
      const emotionChunks = chunkTextForEmotionTagging(bookContent);
      setEmotionProgress(prev => ({ 
        ...prev, 
        total: emotionChunks.length,
        currentChunk: 'Preparing chunks...'
      }));
      
      console.log(`Created ${emotionChunks.length} small chunks for emotion tagging (avg ${Math.round(bookContent.split(/\s+/).length / emotionChunks.length)} words per chunk)`);

      setProcessingStep('Ingesting text chunks for emotion processing...');
      setEmotionProgress(prev => ({ 
        ...prev, 
        currentChunk: 'Ingesting text chunks...'
      }));
      
      const ingestEmotionPayload = {
        created_object_name: 'emotion_chunks',
        data_type: 'strings',
        input_data: emotionChunks
      };
      
      const ingestEmotionResponse = await fetch(`${API_BASE}/input_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ingestEmotionPayload)
      });
      const ingestEmotionResult = await ingestEmotionResponse.json();
      logApiCall('/input_data', 'POST', ingestEmotionPayload, ingestEmotionResult);

      setProcessingStep(`Adding emotion and cadence tags to ${emotionChunks.length} small chunks...`);
      setEmotionProgress(prev => ({ 
        ...prev, 
        currentChunk: 'Starting emotion tagging process...'
      }));
      
      // Much simpler and shorter prompt to avoid timeouts
      const emotionTagPayload = {
        created_object_names: ['tagged_text'],
        prompt_string: `Add Fish Audio tags to this text: {emotion_chunks}

Add (emotion) before sentences and (break) for pauses.
Emotions: serious, excited, angry, sad, curious, confident, nervous, happy, worried, surprised

Example: "(serious)The morning sun cast long shadows. (excited)We finally made it!"

Return the tagged text:`,
        inputs: [{
          input_object_name: 'emotion_chunks',
          mode: 'use_individually'
        }]
      };

      // Simulate progress updates during API call
      const progressInterval = setInterval(() => {
        setEmotionProgress(prev => {
          const elapsed = Date.now() - startTime;
          const avgTimePerChunk = prev.current > 0 ? elapsed / prev.current : 10000; // Estimate 10s per small chunk
          const remaining = prev.total - prev.current;
          const estimatedTimeRemaining = Math.round((remaining * avgTimePerChunk) / 1000);
          
          return {
            ...prev,
            currentChunk: `Processing chunk ${prev.current + 1} of ${prev.total}...`,
            estimatedTimeRemaining
          };
        });
      }, 2000);

      const emotionResponse = await fetch(`${API_BASE}/apply_prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify(emotionTagPayload)
      });
      const emotionResult = await emotionResponse.json();
      logApiCall('/apply_prompt', 'POST', emotionTagPayload, emotionResult);

      clearInterval(progressInterval);

      setProcessingStep('Retrieving tagged text...');
      setEmotionProgress(prev => ({ 
        ...prev, 
        currentChunk: 'Retrieving processed text...'
      }));
      
      const returnTaggedPayload = {
        object_name: 'tagged_text',
        return_type: 'pretty_text'
      };

      const taggedResponse = await fetch(`${API_BASE}/return_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(returnTaggedPayload)
      });

      const taggedResult = await taggedResponse.json();
      logApiCall('/return_data', 'POST', returnTaggedPayload, taggedResult);
      
      console.log('Tagged text result:', taggedResult);
      
      // Use text_value instead of value for properly formatted tagged text
      let taggedTextArray = [];
      
      if (taggedResult.text_value) {
        // Split the text_value by some delimiter if it contains multiple chunks
        // or treat it as a single piece if it's already combined
        const textContent = taggedResult.text_value;
        
        // Try to split by chunk markers or just use as single text
        if (textContent.includes('---CHUNK---') || textContent.includes('CHUNK')) {
          taggedTextArray = textContent.split(/---CHUNK[^-]*---/);
        } else {
          // If no clear chunk markers, we need to get individual chunks
          // Let's try getting the data as JSON to see individual chunks
          const jsonPayload = {
            object_name: 'tagged_text',
            return_type: 'json'
          };

          const jsonResponse = await fetch(`${API_BASE}/return_data`, {
            method: 'POST',
            headers,
            body: JSON.stringify(jsonPayload)
          });

          const jsonResult = await jsonResponse.json();
          logApiCall('/return_data', 'POST', jsonPayload, jsonResult);
          
          if (jsonResult.value && Array.isArray(jsonResult.value)) {
            taggedTextArray = jsonResult.value.map(item => {
              if (typeof item === 'string') {
                return item;
              } else if (item && typeof item === 'object' && item.text) {
                return item.text;
              } else {
                return JSON.stringify(item);
              }
            });
          } else {
            taggedTextArray = [textContent];
          }
        }
      } else if (taggedResult.value) {
        // Fallback to value if text_value is not available
        if (Array.isArray(taggedResult.value)) {
          taggedTextArray = taggedResult.value.map(item => {
            if (typeof item === 'string') {
              return item;
            } else if (item && typeof item === 'object' && item.text) {
              return item.text;
            } else {
              return JSON.stringify(item);
            }
          });
        } else {
          taggedTextArray = [taggedResult.value];
        }
      }
      
      // Filter out empty chunks
      taggedTextArray = taggedTextArray.filter(chunk => chunk && chunk.trim().length > 0);
      
      console.log(`Processed ${taggedTextArray.length} tagged chunks`);
      
      setTaggedChunks(taggedTextArray);
      setCurrentStep(4);
      setProcessingStep('Emotion tagging complete!');
      setEmotionProgress(prev => ({ 
        ...prev, 
        current: taggedTextArray.length, 
        currentChunk: 'Processing complete!',
        estimatedTimeRemaining: 0,
        completedChunks: taggedTextArray.map((_, index) => index)
      }));
      
      // Verify we got the full content
      const originalWordCount = bookContent.split(/\s+/).length;
      const taggedWordCount = taggedTextArray.join(' ').split(/\s+/).length;
      console.log(`Original: ${originalWordCount} words, Tagged: ${taggedWordCount} words`);
      
      if (taggedWordCount < originalWordCount * 0.8) {
        setError(`Warning: Tagged text appears incomplete. Original: ${originalWordCount} words, Tagged: ${taggedWordCount} words. Check API details for more information.`);
      }
      
    } catch (err) {
      setError(`Emotion tagging error: ${err.message}`);
      console.error('Error:', err);
    } finally {
      setProcessing(false);
      // Keep the progress view visible for a moment to show completion
      setTimeout(() => {
        setShowEmotionProgress(false);
      }, 2000);
    }
  };

  const updateVoiceId = (characterIndex, voiceId) => {
    const updatedCharacters = [...characters];
    updatedCharacters[characterIndex] = {
      ...updatedCharacters[characterIndex],
      fish_audio_voice_id: voiceId
    };
    
    setCharacters(updatedCharacters);
    
    // Update rawResults for download
    const updatedRawResults = {
      ...rawResults,
      characters: updatedCharacters
    };
    setRawResults(updatedRawResults);
  };

  const testVoice = (name, dialogueSample, fishAudioVoiceId) => {
    setTestModalData({
      name,
      dialogueSample,
      voiceId: fishAudioVoiceId
    });
    setShowTestModal(true);
  };

  const closeTestModal = () => {
    setShowTestModal(false);
    setTestModalData({ name: '', dialogueSample: '', voiceId: '' });
  };

  const deleteObjects = async () => {
    try {
      const objectsToDelete = ['book_chunks', 'character_extractions', 'final_characters', 'emotion_chunks', 'tagged_text'];
      
      for (const objectName of objectsToDelete) {
        try {
          const response = await fetch(`${API_BASE}/objects/${objectName}`, {
            method: 'DELETE',
            headers
          });
          const result = await response.json();
          logApiCall(`/objects/${objectName}`, 'DELETE', null, result);
        } catch (e) {
          console.log(`Object ${objectName} may not exist`);
        }
      }
      
      setCharacters([]);
      setRawResults(null);
      setTaggedChunks([]);
      setCurrentStep(1);
      setBookContent('');
      setEmotionProgress({ current: 0, total: 0, currentChunk: '', estimatedTimeRemaining: 0, startTime: null, completedChunks: [] });
      setShowEmotionProgress(false);
    } catch (err) {
      setError(`Delete error: ${err.message}`);
    }
  };

  const downloadJSON = () => {
    if (!rawResults && taggedChunks.length === 0) {
      setError('No data available to download');
      return;
    }

    const downloadData = {
      characters: rawResults?.characters || [],
      tagged_text_chunks: taggedChunks,
      metadata: {
        total_chunks: taggedChunks.length,
        total_words: Math.round(bookContent.split(/\s+/).length),
        tagged_words: Math.round(taggedChunks.join(' ').split(/\s+/).length),
        processing_date: new Date().toISOString()
      }
    };

    const jsonContent = JSON.stringify(downloadData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audiobook-analysis.json';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadTaggedText = () => {
    if (taggedChunks.length === 0) {
      setError('No tagged text available to download');
      return;
    }

    const textContent = taggedChunks.join('\n\n---CHUNK BREAK---\n\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tagged-audiobook-text.txt';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedCharacters = React.useMemo(() => {
    if (!sortConfig.key) {
      // Default sort: narrator first, then by relevance
      return [...characters].sort((a, b) => {
        if (a.story_relevance === 'narrator') return -1;
        if (b.story_relevance === 'narrator') return 1;
        
        const relevanceOrder = { 'main': 1, 'supporting': 2, 'minor': 3 };
        const aRelevance = relevanceOrder[a.story_relevance?.toLowerCase()] || 4;
        const bRelevance = relevanceOrder[b.story_relevance?.toLowerCase()] || 4;
        
        return aRelevance - bRelevance;
      });
    }
    
    return [...characters].sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      
      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [characters, sortConfig]);

  const getRelevanceColor = (relevance) => {
    switch (relevance?.toLowerCase()) {
      case 'narrator': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'main': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'supporting': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'minor': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Emotion Progress Page View
  if (showEmotionProgress) {
    return (
      <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                <Zap className="text-primary-600" />
                Adding Emotion & Cadence Tags
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Processing your book text with Fish Audio emotion and cadence tags</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-2xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          {/* Main Progress Card */}
          <div className="card p-8 mb-6">
            <div className="text-center mb-8">
              <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-primary-200 dark:border-primary-800"></div>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-primary-600 transition-all duration-500"
                  style={{
                    clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos(2 * Math.PI * (emotionProgress.current / emotionProgress.total) - Math.PI/2)}% ${50 + 50 * Math.sin(2 * Math.PI * (emotionProgress.current / emotionProgress.total) - Math.PI/2)}%, 50% 50%)`
                  }}
                ></div>
                <Loader2 className="animate-spin text-primary-600 w-8 h-8" />
              </div>
              
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Processing Emotion Tags
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {emotionProgress.currentChunk}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Progress
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {emotionProgress.current} / {emotionProgress.total} chunks
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
                <div 
                  className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{width: emotionProgress.total > 0 ? `${(emotionProgress.current / emotionProgress.total) * 100}%` : '0%'}}
                >
                  {emotionProgress.current > 0 && (
                    <span className="text-xs text-white font-medium">
                      {Math.round((emotionProgress.current / emotionProgress.total) * 100)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Time Estimate */}
              {emotionProgress.estimatedTimeRemaining > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock size={16} />
                  <span>Estimated time remaining: {formatTime(emotionProgress.estimatedTimeRemaining)}</span>
                </div>
              )}
            </div>

            {/* Processing Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {Math.round(bookContent.split(/\s+/).length).toLocaleString()}
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200">Total Words</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {emotionProgress.total}
                </div>
                <div className="text-sm text-green-800 dark:text-green-200">Small Chunks</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                  {emotionProgress.current}
                </div>
                <div className="text-sm text-purple-800 dark:text-purple-200">Completed</div>
              </div>
            </div>

            {/* Chunk Progress Visualization */}
            {emotionProgress.total > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Chunk Processing Status</h3>
                <div className="grid grid-cols-10 gap-2">
                  {Array.from({ length: Math.min(emotionProgress.total, 100) }, (_, index) => (
                    <div
                      key={index}
                      className={`h-4 rounded transition-all duration-300 ${
                        index < emotionProgress.current
                          ? 'bg-green-500'
                          : index === emotionProgress.current
                          ? 'bg-primary-500 animate-pulse'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      title={`Chunk ${index + 1} ${
                        index < emotionProgress.current
                          ? '(completed)'
                          : index === emotionProgress.current
                          ? '(processing)'
                          : '(pending)'
                      }`}
                    />
                  ))}
                </div>
                {emotionProgress.total > 100 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Showing first 100 chunks of {emotionProgress.total} total
                  </p>
                )}
              </div>
            )}

            {/* Current Processing Info */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Zap className="text-primary-600" size={18} />
                What's Happening Now
              </h3>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></div>
                  <span>Processing small chunks (~350 words each) to avoid timeouts</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></div>
                  <span>Adding emotion tags to every sentence for natural speech</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></div>
                  <span>Inserting cadence tags for natural pauses and breaks</span>
                </div>
              </div>
            </div>

            {/* Cancel Button */}
            <div className="flex justify-center mt-8">
              <button
                onClick={() => {
                  setProcessing(false);
                  setShowEmotionProgress(false);
                  setCurrentStep(3);
                }}
                className="btn-secondary flex items-center gap-2"
                disabled={!processing}
              >
                <X size={16} />
                Cancel Processing
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="card p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 mb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-red-600 dark:text-red-400" size={16} />
                <span className="text-red-800 dark:text-red-200">{error}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
              <BookOpen className="text-primary-600" />
              WannaListen.ai Voice Selection
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Upload your book to identify characters and narrator for audiobook voice selection</p>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-2xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Test Modal - Simplified to only show test message */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4">
              <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Play className="text-primary-600" size={20} />
                  Voice Test
                </h3>
                <button
                  onClick={closeTestModal}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-green-800 dark:text-green-200">
                    Testing {testModalData.name} with voice id {testModalData.voiceId} and dialogue "{testModalData.dialogueSample}"
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeTestModal}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        {currentStep === 1 && (
          <div className="card p-8 mb-6">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-gray-900 dark:text-white">
              <Upload className="text-primary-600" />
              Upload Your Book
            </h2>
            
            <div className="mb-6">
              <div className="flex gap-4 mb-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="file"
                    checked={uploadMethod === 'file'}
                    onChange={(e) => setUploadMethod(e.target.value)}
                    className="mr-2 text-primary-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">File Upload</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="text"
                    checked={uploadMethod === 'text'}
                    onChange={(e) => setUploadMethod(e.target.value)}
                    className="mr-2 text-primary-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Text Input</span>
                </label>
              </div>

              {uploadMethod === 'file' ? (
                <div
                  className={`upload-zone ${dragActive ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto mb-4 text-primary-600" size={48} />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Drag and drop your book file here
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Supports TXT and PDF files up to 250,000 words
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-primary"
                    aria-label="Choose file to upload"
                  >
                    Choose File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf"
                    onChange={(e) => handleFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              ) : (
                <div>
                  <textarea
                    value={bookContent}
                    onChange={(e) => setBookContent(e.target.value)}
                    placeholder="Paste your book content here (up to 250,000 words)..."
                    className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-2xl resize-vertical bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    aria-label="Book content input"
                  />
                  <div className="mt-4">
                    <button
                      onClick={() => setCurrentStep(2)}
                      disabled={!bookContent.trim()}
                      className="btn-primary"
                    >
                      Continue to Processing
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing Section */}
        {currentStep === 2 && (
          <div className="card p-8 mb-6">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-gray-900 dark:text-white">
              <Loader2 className="animate-spin text-primary-600" />
              Processing Your Book
            </h2>
            
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="animate-spin text-primary-600" size={20} />
                <span className="text-primary-800 dark:text-primary-200 font-medium">{processingStep}</span>
              </div>
              {chunks.length > 0 && (
                <p className="text-sm text-primary-600 dark:text-primary-400">
                  Processing {chunks.length} chunks ({Math.round(bookContent.split(/\s+/).length / 1000)}k words total)
                </p>
              )}
              <div className="w-full bg-primary-200 dark:bg-primary-800 rounded-full h-2 mt-4">
                <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{width: processing ? '60%' : '100%'}}></div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep(1)}
                disabled={processing}
                className="btn-secondary"
              >
                Back to Upload
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-3 text-gray-900 dark:text-white">
                <Users className="text-primary-600" />
                Character Analysis Results
              </h2>
              
              <div className="flex flex-wrap gap-4 mb-6">
                <button
                  onClick={downloadJSON}
                  disabled={!rawResults}
                  className="btn-success flex items-center gap-2"
                  aria-label="Download results as JSON"
                >
                  <Download size={16} />
                  Download JSON
                </button>
                
                <button
                  onClick={processEmotionTags}
                  disabled={processing || !bookContent.trim()}
                  className="btn-primary flex items-center gap-2"
                  aria-label="Add emotion and cadence tags"
                >
                  <Zap size={16} />
                  Add Emotion Tags
                </button>
                
                <button
                  onClick={() => setShowApiDetails(!showApiDetails)}
                  className="btn-secondary flex items-center gap-2"
                  aria-label="Show API details"
                >
                  <Eye size={16} />
                  {showApiDetails ? 'Hide' : 'Show'} API Details
                </button>
                
                <button
                  onClick={deleteObjects}
                  className="btn-danger flex items-center gap-2"
                  aria-label="Delete all data objects"
                >
                  <Trash2 size={16} />
                  Delete Objects
                </button>
              </div>
            </div>

            {/* Characters Table */}
            {characters.length > 0 && (
              <div className="card overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Character Profiles ({characters.length} characters identified)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Includes narrator and all speaking characters. Add Fish Audio Voice Model IDs for each character.
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        {[
                          { key: 'name', label: 'Character' },
                          { key: 'story_relevance', label: 'Relevance' },
                          { key: 'gender', label: 'Gender' },
                          { key: 'age_range', label: 'Age' },
                          { key: 'nationality', label: 'Accent' },
                          { key: 'personality', label: 'Personality' },
                          { key: 'dialogue_sample', label: 'Voice Sample' },
                          { key: 'fish_audio_voice_id', label: 'Fish Audio Voice ID' },
                          { key: 'actions', label: 'Actions' }
                        ].map(({ key, label }) => (
                          <th
                            key={key}
                            onClick={() => key !== 'fish_audio_voice_id' && key !== 'actions' && handleSort(key)}
                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                              key !== 'fish_audio_voice_id' && key !== 'actions' ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''
                            } transition-colors`}
                            aria-label={key !== 'fish_audio_voice_id' && key !== 'actions' ? `Sort by ${label}` : label}
                          >
                            {label}
                            {sortConfig.key === key && key !== 'fish_audio_voice_id' && key !== 'actions' && (
                              <span className="ml-1">
                                {sortConfig.direction === 'asc' ? 'â' : 'â'}
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {sortedCharacters.map((character, index) => {
                        // Find the original index for updating
                        const originalIndex = characters.findIndex(c => 
                          c.name === character.name && 
                          c.story_relevance === character.story_relevance &&
                          c.dialogue_sample === character.dialogue_sample
                        );
                        
                        const hasVoiceId = character.fish_audio_voice_id && character.fish_audio_voice_id.trim();
                        
                        return (
                          <tr key={`${character.name}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900 dark:text-white">{character.name || 'Unknown'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRelevanceColor(character.story_relevance)}`}>
                                {character.story_relevance || 'unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {character.gender || 'unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {character.age_range || 'unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {character.nationality || 'unknown'}
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <div className="text-sm text-gray-700 dark:text-gray-300 truncate" title={character.personality}>
                                {character.personality || 'No description available'}
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <div className="text-sm text-gray-700 dark:text-gray-300 italic truncate" title={character.dialogue_sample}>
                                {character.dialogue_sample ? `"${character.dialogue_sample}"` : 'No sample available'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Edit3 size={14} className="text-gray-400" />
                                <input
                                  type="text"
                                  value={character.fish_audio_voice_id || ''}
                                  onChange={(e) => updateVoiceId(originalIndex, e.target.value)}
                                  placeholder="Enter voice model ID"
                                  className="w-40 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                  aria-label={`Fish Audio Voice ID for ${character.name}`}
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => testVoice(character.name, character.dialogue_sample, character.fish_audio_voice_id)}
                                disabled={!hasVoiceId}
                                className={`flex items-center gap-2 text-xs px-3 py-1 rounded-2xl font-medium transition-colors ${
                                  hasVoiceId 
                                    ? 'bg-primary-600 hover:bg-primary-700 text-white' 
                                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                }`}
                                aria-label={`Test voice for ${character.name}`}
                              >
                                <Play size={12} />
                                Test
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Tip:</strong> Enter Fish Audio Voice Model IDs in the voice ID column. The test button will be enabled once you add a voice ID.
                  </p>
                </div>
              </div>
            )}

            {/* No Results Message */}
            {characters.length === 0 && currentStep === 3 && (
              <div className="card p-8 text-center">
                <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Characters Found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  The analysis didn't identify any characters or narrator information. Try with a different text or check the API details for more information.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Emotion Tagging Results Section */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-3 text-gray-900 dark:text-white">
                <CheckCircle className="text-green-600" />
                Emotion & Cadence Tagged Text
              </h2>
              
              <div className="flex flex-wrap gap-4 mb-6">
                <button
                  onClick={downloadJSON}
                  disabled={!rawResults && taggedChunks.length === 0}
                  className="btn-success flex items-center gap-2"
                  aria-label="Download complete analysis as JSON"
                >
                  <Download size={16} />
                  Download Complete Analysis
                </button>
                
                <button
                  onClick={downloadTaggedText}
                  disabled={taggedChunks.length === 0}
                  className="btn-primary flex items-center gap-2"
                  aria-label="Download tagged text"
                >
                  <FileText size={16} />
                  Download Tagged Text
                </button>
                
                <button
                  onClick={() => setCurrentStep(3)}
                  className="btn-secondary"
                >
                  Back to Characters
                </button>
                
                <button
                  onClick={() => setShowApiDetails(!showApiDetails)}
                  className="btn-secondary flex items-center gap-2"
                  aria-label="Show API details"
                >
                  <Eye size={16} />
                  {showApiDetails ? 'Hide' : 'Show'} API Details
                </button>
                
                <button
                  onClick={deleteObjects}
                  className="btn-danger flex items-center gap-2"
                  aria-label="Delete all data objects"
                >
                  <Trash2 size={16} />
                  Delete Objects
                </button>
              </div>

              {/* Word count comparison */}
              {taggedChunks.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="text-blue-600" size={16} />
                    <span className="font-medium text-blue-800 dark:text-blue-200">Processing Summary</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600 dark:text-blue-400">Original:</span>
                      <span className="ml-2 font-medium text-blue-800 dark:text-blue-200">
                        {Math.round(bookContent.split(/\s+/).length).toLocaleString()} words
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400">Tagged:</span>
                      <span className="ml-2 font-medium text-blue-800 dark:text-blue-200">
                        {Math.round(taggedChunks.join(' ').split(/\s+/).length).toLocaleString()} words
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400">Chunks:</span>
                      <span className="ml-2 font-medium text-blue-800 dark:text-blue-200">
                        {taggedChunks.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tagged Text Preview */}
            {taggedChunks.length > 0 && (
              <div className="card overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Tagged Text Preview ({taggedChunks.length} chunks processed)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Your text has been enhanced with Fish Audio emotion and cadence tags for natural-sounding audiobook generation.
                  </p>
                </div>
                
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-6">
                    {taggedChunks.slice(0, 3).map((chunk, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Chunk {index + 1}
                          </h4>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {typeof chunk === 'string' ? chunk.split(/\s+/).length : 0} words
                          </span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {typeof chunk === 'string' ? chunk.substring(0, 800) : JSON.stringify(chunk).substring(0, 800)}
                          {(typeof chunk === 'string' ? chunk.length : JSON.stringify(chunk).length) > 800 && '...'}
                        </div>
                      </div>
                    ))}
                    
                    {taggedChunks.length > 3 && (
                      <div className="text-center py-4">
                        <p className="text-gray-600 dark:text-gray-400">
                          ... and {taggedChunks.length - 3} more chunks. Download the complete tagged text to see all content.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Emotion Tags Used:</h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        (serious), (excited), (angry), (sad), (curious), (confident), and more based on context
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Cadence Tags Used:</h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        (break) for natural pauses, (long-break) for dramatic pauses
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* No Tagged Results Message */}
            {taggedChunks.length === 0 && currentStep === 4 && !processing && (
              <div className="card p-8 text-center">
                <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Tagged Text Available</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  The emotion tagging process didn't produce results. Check the API details for more information.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="card p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-red-600 dark:text-red-400" size={16} />
              <span className="text-red-800 dark:text-red-200">{error}</span>
            </div>
          </div>
        )}

        {/* API Details */}
        {showApiDetails && (
          <div className="card p-6 mt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">API Call Details</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {apiCalls.map((call) => (
                <div key={call.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm text-primary-600 dark:text-primary-400">
                      {call.method} {call.endpoint}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                      View Details
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <strong className="text-xs text-gray-500 dark:text-gray-400">Request:</strong>
                        <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(call.payload, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <strong className="text-xs text-gray-500 dark:text-gray-400">Response:</strong>
                        <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(call.response, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Future Features Note */}
        <div className="card p-6 mt-8 border-l-4 border-blue-500">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Coming Soon</h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Voice model search and selection features will be added to help you find the perfect Fish Audio API voices for each character and narrator automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WannaListenApp;
