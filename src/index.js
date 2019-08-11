const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

module.exports = function publish (serverUrl, adminToken, dataDir) {
  const query = buildQuery(dataDir);

  //console.log(query);
  const url = `${serverUrl}/graphql?adminToken=${adminToken}`
  const options = {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query
    })
  }

  //return console.log(url);

  fetch(url, options)
    .then((res) => res.json())
    // .then(res => res.text())          // convert to plain text
    // .then(text => console.log(text))  // then log it out
    .then((res) => {
      console.log(JSON.stringify(res, null, 2))
    })
    .catch((ex) => console.log(ex.stack))
}

// Core Functions

function loadCourses (dataDir) {
  const courses = getFsList(dataDir, { onlyDirs: true })
  return courses
}

function loadLessions (dataDir, course) {
  const courseDir = `${course.position}-${course.id}`
  const dir = path.join(dataDir, courseDir)
  const lessonList = getFsList(dir, { onlyFiles: true })
    .map(({ id, name, position }) => {
      const completeLession = require(path.join(dir, `${position}-${id}.js`))
      return Object.assign({ id, position, courseId: course.id }, completeLession)
    })

  return lessonList
}
function loadLessionsWithSubLessons(dataDir, course) {
  try{
    const courseDir = `${course.position}-${course.id}`
    var absoluteCourseDir = path.join(dataDir ,courseDir)
    const lessions = getFsList(absoluteCourseDir, { onlyDirs: true });
    
    const lessonList = [];
    lessions.forEach((objLession)=>{
      var lessionDirName = `${objLession.position }-${objLession.id}`;
      var subLessionList = getFsList(path.join(absoluteCourseDir, lessionDirName), { onlyFiles: true });
      subLessionList.forEach(({position, id, name})=>{
        const data= require(path.join(absoluteCourseDir, lessionDirName, `${position}-${id}.js`));
        lessonList.push(Object.assign({ id, position, courseId: course.id, moduleName: name,  moduleId: objLession.id  }, data));
      })
    });
  
    return lessonList
  }
  catch(ex){
    console.log(ex);
  }
}

function buildQuery (dataDir) {
  const courses = loadCourses(dataDir)
  const courseMutations = courses.map((c, i) => {
    return `
      c${i}: createCourse(
${toArgs(c, 8)}
      ) { id }
    `
  })
  
  let lessons = []
  courses.forEach((c) => {
    loadLessionsWithSubLessons(dataDir, c).map((l) => lessons.push(l)) // HMD 190811
  })
  //console.log('found coruse: ', lessons);

  const lessionMutations = lessons.map((l, i) => {

    return `
      l${i}: createLesson(
${toArgs(l, 8)}
      ) { id, course { id } }
    `
  })

  const all = [...courseMutations, ...lessionMutations].join('\n')
  return `
    mutation {
      removeAll
      ${all}
    }
  `
}

// Utility functions

function toArgs (item, indent) {
  const itemContent = stringify(item, indent).trim()
  return itemContent.substring(1, itemContent.length - 1)
}

function spaces (n) {
  let str = ''
  for (let lc = 0; lc < n; lc++) {
    str += ' '
  }

  return str
}

function stringify (item, indent = '') {
  switch (typeof item) {
    case 'boolean':
    case 'number':
    case 'string':
      return JSON.stringify(item)
    default:
      if (item instanceof Array) {
        return `[${item.map((i) => stringify(i, indent + 2)).join(' ')}]`
      } else {
        const content = Object.keys(item).map((k) => {
          return `${spaces(indent + 2)}${k}: ${stringify(item[k], indent + 2)}`
        }).join('\n')
        return `\n${spaces(indent)}{\n${content}\n${spaces(indent)}}\n${spaces(indent - 2)}`
      }
  }
}

function getFsList (dir, options = {}) {
  const list = fs.readdirSync(dir)
    .filter((fileName) => {
      const fullFileName = path.join(dir, fileName)
      const stat = fs.statSync(fullFileName)

      if (options.onlyDirs) {
        return stat.isDirectory()
      } else if (options.onlyFiles) {
        return stat.isFile()
      }

      return true
    })
    .map((dirName) => {
      const parts = dirName.split('-')
      const position = parseInt(parts.splice(0, 1)[0])
      const id = parts.join('-').replace('.js', '')
      const name = parts.map((p) => `${p[0].toUpperCase()}${p.substring(1)}`)
        .join(' ')
        .replace('.js', '')

      return { id, name, position }
    })

  return list
}
