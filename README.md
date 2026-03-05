# 🦾 BraçoBot 3D — Fisioterapia Remota

Simulação de um braço robótico para fisioterapia remota, desenvolvida em JavaScript com visualização 3D via Three.js. O objetivo é demonstrar lógica de programação, organização de código e Programação Orientada a Objetos (POO) — sem hardware real.

---

## 📁 Estrutura do Projeto

```
braco-robotico/
├── index.html   →  Estrutura HTML da interface
├── style.css    →  Estilos visuais (design tokens, layout, animações)
└── main.js      →  Lógica completa: classes POO + Three.js 3D + eventos de UI
```



## 🧠 Arquitetura — Classes Principais

### `Articulacao`
Representa uma única junta do braço. Armazena o ângulo atual e aplica limites físicos automaticamente.

```js
const ombro = new Articulacao("Ombro", 90, 0, 180);
ombro.moverPara(120); // move para 120°, respeitando os limites
```

| Articulação | Mínimo | Máximo |
|---|---|---|
| Ombro | 0° | 180° |
| Cotovelo | 0° | 150° |
| Pulso | −45° | 45° |

---

### `BracoRobotico`
Agrega as três articulações e gerencia a execução de exercícios de fisioterapia como sequências de keyframes.

```js
const braco = new BracoRobotico();
braco.moverOmbro(120);
braco.executarExercicio("flexaoOmbro"); // async — executa com pausas entre passos
```

---

### `ControladorRemoto`
Simula comandos chegando via rede de um fisioterapeuta. Faz o parse de strings de texto e chama os métodos do braço.

```js
const remoto = new ControladorRemoto(braco);
remoto.processar("SET_SHOULDER 120");
remoto.processar("RUN_EXERCISE flexaoCotovelo");
remoto.processar("RESET");
```

**Comandos disponíveis:**

| Comando | Parâmetro | Exemplo |
|---|---|---|
| `SET_SHOULDER` | 0 – 180 | `SET_SHOULDER 120` |
| `SET_ELBOW` | 0 – 150 | `SET_ELBOW 90` |
| `SET_WRIST` | −45 – 45 | `SET_WRIST -20` |
| `RUN_EXERCISE` | nome | `RUN_EXERCISE rotacaoCompleta` |
| `RESET` | — | `RESET` |

---

## 🏋️ Exercícios de Fisioterapia

Cada exercício é uma sequência de **keyframes** — posições-alvo com um tempo de espera entre cada uma. O sistema percorre a lista com `async/await`, criando a ilusão de movimento contínuo.

```js
flexaoOmbro: {
  passos: [
    { s: 30,  e: 45, w: 0, d: 650 }, // posição 1, espera 650ms
    { s: 90,  e: 45, w: 0, d: 650 }, // posição 2, espera 650ms
    { s: 150, e: 45, w: 0, d: 650 }, // posição 3 ...
  ]
}
// s = ombro | e = cotovelo | w = pulso | d = delay em ms
```

| Exercício | Articulações |
|---|---|
| `flexaoOmbro` | Ombro |
| `flexaoCotovelo` | Cotovelo |
| `rotacaoCompleta` | Ombro + Cotovelo + Pulso |
| `reabilitacao` | Ombro + Cotovelo + Pulso |

---

## 🌐 Visualização 3D

O braço é construído com uma **hierarquia de pivôs** no Three.js. Quando o ombro gira, ele arrasta o cotovelo, o pulso e a garra — exatamente como um braço humano.

```
scene
└── pivotShoulder   ← gira com o ombro
    └── pivotElbow  ← gira com o cotovelo
        └── pivotWrist ← gira com o pulso
            └── garra + LED
```

A câmera é orbital — **arraste** para rotacionar, **scroll** para zoom.

---

## 🔌 Integração com Hardware Real

Em um sistema real, o `ControladorRemoto` receberia mensagens via WebSocket de um servidor Node.js, que as repassaria ao ESP8266 para controlar servomotores físicos.

```
Fisioterapeuta (navegador)
        ↓ WebSocket
Servidor Node.js
        ↓ WiFi / Serial
ESP8266 / Arduino
        ↓ PWM
Servomotores SG90
```

O mapeamento de ângulo para PWM é direto — o SG90 aceita valores de 0° a 180° via `servo.write(angulo)` no Arduino.

---

## 🛠️ Tecnologias

| Tecnologia | Versão | Uso |
|---|---|---|
| JavaScript | ES2020 | Linguagem principal |
| Three.js | r128 | Renderização 3D |
| HTML5 | — | Estrutura da interface |
| CSS3 | — | Estilo e layout |

---

