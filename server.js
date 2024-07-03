import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Database connected'))
    .catch(err => console.log(err));

app.use('/api/auth', authRoutes);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const reverseLanguageCodeMapForNMT = {
    "assamese": "as",
    "bengali": "bn",
    "english": "en",
    "gujarati": "gu",
    "hindi": "hi",
    "kannada": "kn",
    "malayalam": "ml",
    "marathi": "mr",
    "odia": "or",
    "punjabi": "pa",
    "tamil": "ta",
    "telugu": "te",
    "dogri": "doi",
    "maithili": "mai",
    "santali": "sat",
    "bodo": "brx",
    "sanskrit": "sa",
    "nepali": "ne",
    "manipuri": "mni",
    "konkani": "kok",
    "kashmiri": "ks",
    "kashmiri(arabic)": "kas-IN",
    "urdu": "ur",
};

app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const fileContent = req.file.buffer.toString('utf-8');

        const segments = fileContent.split('.').filter(line => line.trim().length > 0).map((segment, index) => ({
            id: index,
            text: segment.trim(),
        }));

        const { targetLanguage } = req.body;

        const tgtLangCode = reverseLanguageCodeMapForNMT[targetLanguage.toLowerCase()];

        const requestData = {
            data: segments.map(segment => segment.text),
            src: 'en',
            tgt: tgtLangCode,
            mask: true,
            mask_terms: { working: 'asasas', Ashutosh: 'Akash' },
            filter_profane: true,
            domain: 1,
            logging: true,
        };

        const apiResponse = await axios.post('https://revapi.reverieinc.com/translate', requestData, {
            headers: {
                'REV-API-KEY': process.env.REV_API_KEY,
                'REV-APP-ID': process.env.REV_APP_ID,
                'REV-APPNAME': process.env.REV_APPNAME,
                'Content-Type': 'application/json',
            },
        });

        const translatedSegments = apiResponse.data.result.map((translatedText, index) => ({
            id: index,
            text: translatedText,
        }));

        const responseSegments = segments.map((segment, index) => ({
            id: segment.id,
            originalText: segment.text,
            translatedText: translatedSegments[index].text,
        }));

        const translatedContent = responseSegments.map(segment => segment.translatedText[0]).join('. ');

        res.json({
            segments: responseSegments,
            translatedContent: translatedContent,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error processing file.');
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
