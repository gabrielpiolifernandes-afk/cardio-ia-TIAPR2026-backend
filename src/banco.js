// Aula do dia 28/10/2026
// SQLite do CardioIA. Um arquivo, tres tabelas, seed do catalogo.
// classificarPressao e analisarPerfil sao as mesmas funcoes da aula do dia 02/09/2026.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pastaDados = path.join(__dirname, 'dados')
fs.mkdirSync(pastaDados, { recursive: true })

const catalogo = JSON.parse(
  fs.readFileSync(path.join(pastaDados, 'catalogo.json'), 'utf8'),
)

export const caminhoDb = path.join(pastaDados, 'cardioia.db')
export const db = new DatabaseSync(caminhoDb)

const SQL_ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pacientes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  idade INTEGER,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS afericoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  sistolica INTEGER NOT NULL,
  diastolica INTEGER NOT NULL,
  pulso INTEGER,
  contexto TEXT NOT NULL,
  registrado_em TEXT NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);
`

export function classificarPressao(sistolica, diastolica) {
  const s = Number(sistolica)
  const d = Number(diastolica)

  if (s >= 180 || d >= 120) {
    return { rotulo: 'Crise', nivel: 'crise' }
  }

  if (s >= 140 || d >= 90) {
    return { rotulo: 'Alta', nivel: 'alta' }
  }

  if (s >= 130 || d >= 85) {
    return { rotulo: 'Limítrofe', nivel: 'limite' }
  }

  if (s >= 120 || d >= 80) {
    return { rotulo: 'Atenção', nivel: 'atencao' }
  }

  return { rotulo: 'Normal', nivel: 'normal' }
}

export function analisarPerfil(afericoes) {
  if (!afericoes.length) {
    return {
      rotulo: 'Sem histórico',
      nivel: 'vazio',
      texto:
        'Ainda não há aferições deste paciente. Registre pelo menos duas medições, em horários diferentes, para montar o perfil.',
    }
  }

  const ordenadas = [...afericoes].sort(
    (a, b) => new Date(a.registradoEm) - new Date(b.registradoEm),
  )
  const ultima = ordenadas[ordenadas.length - 1]
  const classeUltima = classificarPressao(ultima.sistolica, ultima.diastolica)

  if (classeUltima.nivel === 'crise') {
    return {
      rotulo: 'Cuidados médicos',
      nivel: 'crise',
      texto:
        'A última aferição chegou em faixa de crise (educacional: sistólica ≥ 180 ou diastólica ≥ 120). Oriente busca de atendimento. Isto não é diagnóstico.',
    }
  }

  if (ordenadas.length >= 2) {
    const anterior = ordenadas[ordenadas.length - 2]
    const deltaS = ultima.sistolica - anterior.sistolica
    if (deltaS >= 15 && ultima.contexto === 'dor') {
      return {
        rotulo: 'Elevação com dor',
        nivel: 'atencao',
        texto: `A sistólica subiu ${deltaS} mmHg em relação à medição anterior, no contexto de dor. Vale repetir em repouso. Se permanecer alta, buscar avaliação. Recorte educacional, não laudo.`,
      }
    }
  }

  const altas = ordenadas.filter((item) => {
    const classe = classificarPressao(item.sistolica, item.diastolica)
    return classe.nivel === 'alta' || classe.nivel === 'crise'
  })

  if (altas.length >= 2 || (ordenadas.length >= 3 && altas.length / ordenadas.length >= 0.5)) {
    return {
      rotulo: 'Perfil hipertensivo',
      nivel: 'alta',
      texto: `Das ${ordenadas.length} aferições, ${altas.length} ficaram em alta ou crise. Padrão compatível com acompanhamento de hipertensão, sempre como material didático.`,
    }
  }

  if (classeUltima.nivel === 'alta' || classeUltima.nivel === 'limite') {
    return {
      rotulo: 'Atenção na última medição',
      nivel: classeUltima.nivel,
      texto: `A medição mais recente ficou em ${classeUltima.rotulo}. Repita em outro horário para confirmar o padrão deste paciente.`,
    }
  }

  return {
    rotulo: 'Estável neste recorte',
    nivel: 'normal',
    texto: 'As medições registradas, neste recorte educacional, não indicam crise. Continue isolando os dados por paciente e anotando o horário.',
  }
}

function semear() {
  const jaTem = db
    .prepare('SELECT COUNT(*) AS total FROM usuarios')
    .get()

  if (jaTem.total > 0) {
    return
  }

  const inserirUsuario = db.prepare(
    'INSERT INTO usuarios (id, nome, usuario, senha, criado_em) VALUES (?, ?, ?, ?, ?)',
  )
  const inserirPaciente = db.prepare(
    'INSERT INTO pacientes (id, nome, idade, criado_em) VALUES (?, ?, ?, ?)',
  )

  db.exec('BEGIN')
  try {
    for (const item of catalogo.usuarios) {
      inserirUsuario.run(item.id, item.nome, item.usuario, item.senha, item.criadoEm)
    }
    for (const item of catalogo.pacientes) {
      inserirPaciente.run(item.id, item.nome, item.idade ?? null, item.criadoEm)
    }
    db.exec('COMMIT')
  } catch (erro) {
    db.exec('ROLLBACK')
    throw erro
  }
}

export function garantirBanco() {
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SQL_ESQUEMA)
  semear()
}

export function listarUsuarios() {
  const linhas = db
    .prepare('SELECT id, nome, usuario, criado_em FROM usuarios ORDER BY id')
    .all()

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    usuario: linha.usuario,
    criadoEm: linha.criado_em,
  }))
}

export function listarPacientes() {
  const linhas = db
    .prepare('SELECT id, nome, idade, criado_em FROM pacientes ORDER BY id')
    .all()

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    idade: linha.idade,
    criadoEm: linha.criado_em,
  }))
}

export function buscarPaciente(id) {
  const linha = db
    .prepare('SELECT id, nome, idade, criado_em FROM pacientes WHERE id = ?')
    .get(id)

  if (!linha) {
    return null
  }

  return {
    id: linha.id,
    nome: linha.nome,
    idade: linha.idade,
    criadoEm: linha.criado_em,
  }
}

function montarAfericao(linha) {
  return {
    id: linha.id,
    pacienteId: linha.paciente_id,
    sistolica: linha.sistolica,
    diastolica: linha.diastolica,
    pulso: linha.pulso,
    contexto: linha.contexto,
    registradoEm: linha.registrado_em,
    classificacao: classificarPressao(linha.sistolica, linha.diastolica),
  }
}

export function listarAfericoes(pacienteId) {
  const sql = pacienteId
    ? `SELECT id, paciente_id, sistolica, diastolica, pulso, contexto, registrado_em
       FROM afericoes WHERE paciente_id = ? ORDER BY id`
    : `SELECT id, paciente_id, sistolica, diastolica, pulso, contexto, registrado_em
       FROM afericoes ORDER BY id`

  const linhas = pacienteId ? db.prepare(sql).all(pacienteId) : db.prepare(sql).all()
  return linhas.map(montarAfericao)
}

export function buscarAfericao(id) {
  const linha = db
    .prepare(
      `SELECT id, paciente_id, sistolica, diastolica, pulso, contexto, registrado_em
       FROM afericoes WHERE id = ?`,
    )
    .get(id)

  return linha ? montarAfericao(linha) : null
}

export function inserirPaciente({ nome, idade }) {
  const criadoEm = new Date().toISOString()
  const resultado = db
    .prepare('INSERT INTO pacientes (nome, idade, criado_em) VALUES (?, ?, ?)')
    .run(nome, idade ?? null, criadoEm)

  return buscarPaciente(Number(resultado.lastInsertRowid))
}

export function inserirAfericao({ pacienteId, sistolica, diastolica, pulso, contexto }) {
  const registradoEm = new Date().toISOString()
  const resultado = db
    .prepare(
      `INSERT INTO afericoes
        (paciente_id, sistolica, diastolica, pulso, contexto, registrado_em)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(pacienteId, sistolica, diastolica, pulso ?? null, contexto, registradoEm)

  return buscarAfericao(Number(resultado.lastInsertRowid))
}

export function montarPerfil(id) {
  const paciente = buscarPaciente(id)
  if (!paciente) {
    return null
  }

  const afericoes = listarAfericoes(id)
  return {
    paciente,
    afericoes,
    perfil: analisarPerfil(afericoes),
  }
}