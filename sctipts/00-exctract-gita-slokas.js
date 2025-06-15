// "Бхагавад-гита 12.18–19"

const fs = require('fs');

// Read stats.json with error handling
let stats;
try {
    stats = JSON.parse(fs.readFileSync('./json/stats.json', 'utf8'));
} catch (err) {
    console.error('Error reading stats.json:', err);
    console.log('Make sure the file exists at ./json/stats.json');
    process.exit(1);
}

// Helper functions
const normalizeVerseNumber = (key) => {
    const [chapter, verse] = key.replace('Бхагавад-гита ', '').split('.');
    return [{
        chapter: parseInt(chapter),
        verse: verse.trim(), // Keep original verse format (don't split ranges)
    }];
};

// Get all Bhagavad-gita verses from usageByVerse
const gitaVerses = Object.keys(stats.usageByVerse)
    .filter(key => key.startsWith('Бхагавад-гита '))
    .flatMap(key => {
        const verses = normalizeVerseNumber(key);
        return verses.map(v => ({
            ...v,
            count: stats.usageByVerse[key]
        }));
    });

// Create output array for collected verses
const output = {
    verses: []
};

// Helper function to get verse range from string
const getVerseRange = (verseStr) => {
    if (verseStr.includes('-')) {
        const [start, end] = verseStr.split('-').map(v => parseInt(v.trim()));
        return { a: start, b: end };
    }
    if (verseStr.includes(',')) {
        const nums = verseStr.split(',').map(v => parseInt(v.trim()));
        return { a: Math.min(...nums), b: Math.max(...nums) };
    }
    const num = parseInt(verseStr.trim());
    return { a: num, b: num };
};

// Helper function to check verse match
const isVerseMatch = (verseNum, targetVerse) => {
    const [chapter, verseStr] = verseNum.split('.');
    const [targetChapter, targetVerseStr] = targetVerse.split('.');
    
    if (chapter !== targetChapter) return false;
    
    const range1 = getVerseRange(verseStr);
    const range2 = getVerseRange(targetVerseStr);
    
    // Check if ranges overlap (inclusive intersection)
    return range1.a <= range2.b && range2.a <= range1.b;
};

// Read each chapter file and find matching verses
gitaVerses.forEach(gitaVerse => {
    // Pad chapter number with leading zero
    const chapterFile = `./json/lv/${gitaVerse.chapter.toString().padStart(2, '0')}.json`;
    
    try {
        const chapterData = JSON.parse(fs.readFileSync(chapterFile, 'utf8'));
        
        // Find matching verse considering different formats
        let verse = chapterData.verses.find(v => {
            if (v.number === `${gitaVerse.chapter}.${gitaVerse.verse}`) return true;
            
            if (v.number.startsWith(`${gitaVerse.chapter}.`)) {
                const matched = isVerseMatch(v.number, `${gitaVerse.chapter}.${gitaVerse.verse}`);
                if (matched) {
                    // console.log(`Found verse ${gitaVerse.chapter}.${gitaVerse.verse} in verse ${v.number}`);
                }
                return matched;
            }
            return false;
        });
        
        if (verse) {
            // Log gitaVerse original number and found verse number.
            // console.log(`Found verse ${gitaVerse.chapter}.${gitaVerse.verse} in chapter ${gitaVerse.chapter}:`, verse.number);
            // Copy verse without word_by_word
            const { word_by_word, ...verseWithoutWordByWord } = verse;
            
            // Add usage count from stats
            verseWithoutWordByWord.usage_count = gitaVerse.count;
            
            output.verses.push(verseWithoutWordByWord);
        } // else warning if verse not found
        else {
            console.warn(`Verse ${gitaVerse.chapter}.${gitaVerse.verse} not found in chapter ${gitaVerse.chapter}`);
        }
    } catch (err) {
        console.error(`Error reading chapter file ${chapterFile}:`, err);
    }
});

// Sort verses by chapter and verse number
output.verses.sort((a, b) => {
    const [aChapter, aVerse] = a.number.split('.').map(Number);
    const [bChapter, bVerse] = b.number.split('.').map(Number);
    
    if (aChapter !== bChapter) {
        return aChapter - bChapter;
    }
    return aVerse - bVerse;
});

// Ensure output directory exists
const outputDir = './output';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Write output file with error handling
try {
    fs.writeFileSync('./output/all.json', JSON.stringify(output, null, 2));
    console.log(`Successfully wrote ${output.verses.length} verses to output/all.json`);
} catch (err) {
    console.error('Error writing output file:', err);
    process.exit(1);
}

console.log(`Processed ${output.verses.length} verses`);
