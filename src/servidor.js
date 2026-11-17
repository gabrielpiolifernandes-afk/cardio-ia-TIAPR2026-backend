// Aula do dia 28/10/2026
// Processo no terminal. Express recebe HTTP. SQLite grava cardioia.db.
// O React com Vite continua parado. JWT fica para as aulas seguintes.

import express from 'express'
import cors from 'cors'
import {
  buscarAfericao,
  buscarPaciente,
  garantirBanco,
  inserirAfericao,
  inserirPaciente,
  listarAfericoes,
  listarPacientes,
  listarUsuarios,
  montarPerfil,
} from './banco.js'

const app = express()
const PORTA = Number(process.env.PORTA) || 3000
const CONTEXTOS = new Set(['rotina', 'dor', 'esforco', 'outro'])

app.use(cors())
app.use(express.json())

app.get('/cardioia', (_req, res) => {
  res.status(200).json({
    ok: true,
    servico: 'cardioia-api',
    agora: new Date().toISOString(),
  })
})

app.get('/usuarios', (_req, res) => {
  res.status(200).json(listarUsuarios())
})

app.get('/pacientes', (_req, res) => {
  res.status(200).json(listarPacientes())
})

app.get('/pacientes/:id/perfil', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ erro: 'Id inválido.' })
    return
  }

  const perfil = montarPerfil(id)
  if (!perfil) {
    res.status(404).json({ erro: 'Paciente não encontrado.' })
    return
  }

  res.status(200).json(perfil)
})

app.get('/pacientes/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ erro: 'Id inválido.' })
    return
  }

  const paciente = buscarPaciente(id)
  if (!paciente) {
    res.status(404).json({ erro: 'Paciente não encontrado.' })
    return
  }

  res.status(200).json(paciente)
})

app.post('/pacientes', (req, res) => {
  const nome = String(req.body.nome ?? '').trim()
  const idadeBruta = req.body.idade
  const idade =
    idadeBruta === '' || idadeBruta === null || idadeBruta === undefined
      ? null
      : Number(idadeBruta)

  if (!nome) {
    res.status(400).json({ erro: 'nome é obrigatório.' })
    return
  }

  if (idade !== null && (!Number.isInteger(idade) || idade < 1 || idade > 120)) {
    res.status(400).json({ erro: 'idade inválida.' })
    return
  }

  const criado = inserirPaciente({ nome, idade })
  res.status(201).json(criado)
})

app.get('/afericoes', (req, res) => {
  const pacienteIdBruto = req.query.pacienteId
  if (pacienteIdBruto === undefined) {
    res.status(200).json(listarAfericoes())
    return
  }

  const pacienteId = Number(pacienteIdBruto)
  if (!Number.isInteger(pacienteId)) {
    res.status(400).json({ erro: 'pacienteId inválido.' })
    return
  }

  if (!buscarPaciente(pacienteId)) {
    res.status(404).json({ erro: 'Paciente não encontrado.' })
    return
  }

  res.status(200).json(listarAfericoes(pacienteId))
})

app.get('/afericoes/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ erro: 'Id inválido.' })
    return
  }

  const afericao = buscarAfericao(id)
  if (!afericao) {
    res.status(404).json({ erro: 'Aferição não encontrada.' })
    return
  }

  res.status(200).json(afericao)
})

app.post('/afericoes', (req, res) => {
  const pacienteId = Number(req.body.pacienteId)
  const sistolica = Number(req.body.sistolica)
  const diastolica = Number(req.body.diastolica)
  const pulso =
    req.body.pulso === '' || req.body.pulso === null || req.body.pulso === undefined
      ? null
      : Number(req.body.pulso)
  const contexto = String(req.body.contexto ?? 'rotina')

  if (!pacienteId || !sistolica || !diastolica) {
    res.status(400).json({
      erro: 'pacienteId, sistolica e diastolica são obrigatórios.',
    })
    return
  }

  if (sistolica <= diastolica) {
    res.status(400).json({
      erro: 'A sistólica precisa ser maior que a diastólica.',
    })
    return
  }

  if (!CONTEXTOS.has(contexto)) {
    res.status(400).json({
      erro: 'contexto inválido. Use rotina, dor, esforco ou outro.',
    })
    return
  }

  if (pulso !== null && (!Number.isInteger(pulso) || pulso < 30 || pulso > 220)) {
    res.status(400).json({ erro: 'pulso inválido.' })
    return
  }

  const paciente = buscarPaciente(pacienteId)
  if (!paciente) {
    res.status(404).json({ erro: 'Paciente não encontrado.' })
    return
  }

  const criada = inserirAfericao({
    pacienteId,
    sistolica,
    diastolica,
    pulso,
    contexto,
  })

  res.status(201).json(criada)
})

app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' })
})

garantirBanco()

const servidor = app.listen(PORTA, () => {
  if (!servidor.address()) {
    return
  }

  console.log(`API do CardioIA em http://localhost:${PORTA}`)
})

servidor.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    console.error(`A porta ${PORTA} já está em uso. Feche a outra API e suba de novo.`)
  } else {
    console.error(erro)
  }

  process.exit(1)
})