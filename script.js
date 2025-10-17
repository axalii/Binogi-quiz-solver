let disciplines = [];
async function loadDisciplines() {
  try {
    const response = await fetch('https://api.binogi.se/disciplines');
    const data = await response.json();
    disciplines = data
      .flatMap(discipline => discipline.courses || [])
      .flatMap(course => course.subjects || [])
      .flatMap(subject => subject.lessons || []);
    console.log(`Loaded ${disciplines.length} lessons into memory.`);
  } catch (error) {}
}

function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/å/g, 'aa')
    .toLowerCase();
}

async function extractAndFetchAnswers(urlInput) {
  if (disciplines.length === 0) {
    await loadDisciplines();
  }
  const level1 = document.getElementById('level1');
  const level2 = document.getElementById('level2');
  const level3 = document.getElementById('level3');
  level1.innerHTML = '';
  level2.innerHTML = '';
  level3.innerHTML = '';
  level1.classList.remove('active');
  level2.classList.remove('active');
  level3.classList.remove('active');
  const match = urlInput.match(/https:\/\/app\.binogi\.se\/l\/(.+)/);
  if (!match) {
    return;
  }
  const slug = match[1];
  const normalizedSlug = normalizeText(slug);
  const lesson = disciplines.find(lesson => {
    const normalizedLessonSlug = normalizeText(lesson.slug);
    const normalizedLessonTitle = normalizeText(lesson.title);
    return normalizedLessonSlug === normalizedSlug || normalizedLessonTitle === normalizedSlug;
  });
  if (!lesson) {
    level1.innerHTML = '<p>No lesson found.</p>';
    level1.classList.add('active');
    return;
  }
  const quizUrl = `https://lessons.binogi.net/api/v3/lessons/${lesson.code}/quiz/`;
  try {
    const response = await fetch(quizUrl);
    if (!response.ok) throw new Error();
    const quizData = await response.json();
    processQuizAnswers(quizData);
    document.getElementById('urlInput').value = '';
  } catch (error) {
    level1.innerHTML = '<p>Couldn’t fetch answers.</p>';
    level1.classList.add('active');
  }
}

function processQuizAnswers(data) {
  if (!data.quiz || !data.quiz.questions) {
    document.getElementById('level1').innerHTML = '<p>No quiz questions found.</p>';
    document.getElementById('level1').classList.add('active');
    return;
  }
  const questions = data.quiz.questions;
  let hasLevel1 = false, hasLevel2 = false, hasLevel3 = false;
  questions.forEach((q) => {
    if (q.text && q.level) {
      const langs = q.text.SE ? q.text.SE.sv : Object.values(q.text)[0];
      const questionText = langs || 'Question text missing';
      let questionHTML = `<div class="question"><p>${questionText}</p>`;
      const correctAnswers = q.options
        .filter(option => option.isCorrect && option.text)
        .map(option => {
          const optLangs = option.text.SE ? option.text.SE.sv : Object.values(option.text)[0];
          return optLangs || 'Answer text missing';
        });
      if (correctAnswers.length > 0) {
        correctAnswers.forEach(answer => {
          questionHTML += `<p class="correct-answer">${answer}</p>`;
        });
      } else {
        questionHTML += `<p class="correct-answer">No answer found</p>`;
      }
      questionHTML += `</div>`;
      const levelDiv = document.getElementById(`level${q.level}`);
      if (levelDiv) {
        if (q.level === 1 && !hasLevel1) {
          levelDiv.innerHTML = '<h2>Level 1</h2>';
          hasLevel1 = true;
        } else if (q.level === 2 && !hasLevel2) {
          levelDiv.innerHTML = '<h2>Level 2</h2>';
          hasLevel2 = true;
        } else if (q.level === 3 && !hasLevel3) {
          levelDiv.innerHTML = '<h2>Level 3</h2>';
          hasLevel3 = true;
        }
        levelDiv.innerHTML += questionHTML;
        levelDiv.classList.add('active');
      }
    }
  });
}

const urlInput = document.getElementById('urlInput');
urlInput.addEventListener('input', () => {
  const value = urlInput.value.trim();
  if (value.includes('https://app.binogi.se/l/')) {
    extractAndFetchAnswers(value);
  }
});

document.addEventListener('paste', (e) => {
  const pastedText = e.clipboardData.getData('text');
  if (pastedText.includes('https://app.binogi.se/l/')) {
    e.preventDefault();
    urlInput.value = pastedText;
    extractAndFetchAnswers(pastedText);
  }
});

loadDisciplines();