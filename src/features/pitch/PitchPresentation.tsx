import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Expand, Leaf, Link2, Network, Quote, Store, X } from "lucide-react";
import logoImg from "@/assets/logo.png";
import farmImg from "@/assets/pitch/slide-1-farm.png";
import urgencyImg from "@/assets/pitch/slide-2-urgency.png";
import personaImg from "@/assets/pitch/slide-3-persona.png";
import problemImg from "@/assets/pitch/slide-4-problem.png";
import solutionImg from "@/assets/pitch/slide-5-solution.png";
import validationImg from "@/assets/pitch/slide-6-validation.png";
import partnershipImg from "@/assets/pitch/slide-7-partnership.png";
import {
  audienceTypes,
  painPoints,
  pilotMetrics,
  pitchSlides,
  problemSteps,
  solutionBenefits,
  validationSignals,
} from "./pitch-data";
import "./pitch.css";

const SLIDE_COUNT = pitchSlides.length;

export function PitchPresentation() {
  const [current, setCurrent] = useState(0);
  const touchStart = useRef<number | null>(null);

  const goTo = useCallback((index: number) => {
    setCurrent(Math.max(0, Math.min(SLIDE_COUNT - 1, index)));
  }, []);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const previous = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        next();
      }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        previous();
      }
      if (event.key === "Home") goTo(0);
      if (event.key === "End") goTo(SLIDE_COUNT - 1);
      if (event.key.toLowerCase() === "f") void document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, next, previous]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen?.();
  };

  return (
    <main
      className="pitch-shell"
      aria-label="Apresentação do pitch Origem Conecta"
      onTouchStart={(event) => {
        touchStart.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const end = event.changedTouches[0]?.clientX;
        if (touchStart.current === null || end === undefined) return;
        const delta = end - touchStart.current;
        if (Math.abs(delta) > 48) delta < 0 ? next() : previous();
        touchStart.current = null;
      }}
    >
      <a className="pitch-close" href="/" aria-label="Sair da apresentação">
        <X aria-hidden="true" />
      </a>

      <section
        className={`pitch-slide pitch-hero ${current === 0 ? "is-active" : ""}`}
        aria-hidden={current !== 0}
      >
        <img
          className="pitch-hero-image"
          src={farmImg}
          alt="Vista aérea de uma fazenda brasileira cercada por lavouras"
        />
        <div className="pitch-hero-shade" />
        <div className="pitch-hero-content">
          <img src={logoImg} alt="" className="pitch-logo-mark" />
          <p className="pitch-kicker">Origem Conecta</p>
          <h1>
            Produção local existe.
            <br />
            Demanda real também.
          </h1>
          <p className="pitch-hero-punch">O problema é que elas ainda não se encontram.</p>
        </div>
        <div className="pitch-hero-tag">
          <Network aria-hidden="true" />
          <span>Negócios que nascem no campo</span>
        </div>
      </section>

      <section
        className={`pitch-slide pitch-question ${current === 1 ? "is-active" : ""}`}
        aria-hidden={current !== 1}
      >
        <div className="pitch-question-number">02</div>
        <div className="pitch-question-grid">
          <div>
            <p className="pitch-kicker">Uma situação conhecida</p>
            <h2>Você já precisou repor o estoque com urgência...</h2>
          </div>
          <div className="pitch-question-visual">
            <img
              src={urgencyImg}
              alt="Compradora de restaurante verificando no celular a reposição de alimentos"
            />
            <div className="pitch-question-card">
              <Quote aria-hidden="true" />
              <p>...sem saber quem tinha o produto perto de você?</p>
            </div>
          </div>
        </div>
        <p className="pitch-footline">
          Hoje, abastecer ainda depende de mensagens, indicação e tentativa e erro.
        </p>
      </section>

      <section
        className={`pitch-slide pitch-persona ${current === 2 ? "is-active" : ""}`}
        aria-hidden={current !== 2}
      >
        <div className="pitch-persona-profile">
          <img
            className="pitch-persona-image"
            src={personaImg}
            alt="Comerciante pensando em preço, produtos e entrega enquanto fala ao telefone"
          />
          <div className="pitch-persona-shade" />
          <div className="pitch-persona-monogram" aria-hidden="true">
            M
          </div>
          <p className="pitch-kicker">A pessoa por trás do problema</p>
          <h2>Mariana Alves</h2>
          <p>Responsável por compras em um restaurante que precisa de abastecimento constante.</p>
          <div className="pitch-persona-products">
            frutas · cafés · doces artesanais · produtos locais
          </div>
        </div>
        <div className="pitch-persona-pains">
          <p className="pitch-kicker">Toda semana, a mesma pressão</p>
          {painPoints.map(({ icon: Icon, text }, index) => (
            <article key={text}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Icon aria-hidden="true" />
              <h3>{text}</h3>
            </article>
          ))}
          <blockquote>
            “Eu quero comprar local, mas preciso decidir rápido e acompanhar o pedido.”
          </blockquote>
        </div>
      </section>

      <section
        className={`pitch-slide pitch-problem ${current === 3 ? "is-active" : ""}`}
        aria-hidden={current !== 3}
      >
        <img
          className="pitch-problem-image"
          src={problemImg}
          alt="Cadeia desconectada entre produtor, transporte e cliente"
        />
        <header className="pitch-heading-row">
          <div>
            <p className="pitch-kicker">O vilão</p>
            <h2>A informação está espalhada.</h2>
          </div>
          <p>
            Produção local e demanda real percorrem caminhos paralelos — sem uma ponte confiável.
          </p>
        </header>
        <div className="pitch-problem-flow">
          {problemSteps.map(({ icon: Icon, title, detail }, index) => (
            <article key={title}>
              <div className="pitch-problem-icon">
                <Icon aria-hidden="true" />
              </div>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
        <div className="pitch-loss-line">
          <span>o comprador perde tempo</span>
          <span>o produtor perde oportunidade</span>
          <span>o alimento perde mercado</span>
        </div>
      </section>

      <section
        className={`pitch-slide pitch-solution ${current === 4 ? "is-active" : ""}`}
        aria-hidden={current !== 4}
      >
        <img
          className="pitch-solution-image"
          src={solutionImg}
          alt="Produtor e compradora conferindo juntos um pedido digital de alimentos frescos"
        />
        <div className="pitch-solution-shade" />
        <div className="pitch-solution-title">
          <p className="pitch-kicker">A solução</p>
          <h2>Uma ponte digital entre as duas pontas.</h2>
          <p>O Origem Conecta organiza a informação para a negociação direta acontecer.</p>
        </div>
        <div className="pitch-bridge" aria-label="Fluxo entre produtor, plataforma e comprador">
          <div className="pitch-bridge-end">
            <SproutMark />
            <span>Produtor local</span>
          </div>
          <div className="pitch-bridge-line">
            <span />
          </div>
          <div className="pitch-bridge-core">
            <img src={logoImg} alt="Origem Conecta" />
          </div>
          <div className="pitch-bridge-line">
            <span />
          </div>
          <div className="pitch-bridge-end pitch-bridge-buyer">
            <Store aria-hidden="true" />
            <span>Comprador</span>
          </div>
        </div>
        <div className="pitch-benefits">
          {solutionBenefits.map(({ icon: Icon, title, detail }) => (
            <article key={title}>
              <Icon aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="pitch-boundary">
          A plataforma não faz a logística. Ela organiza portfólio, disponibilidade, cotação, pedido
          e acompanhamento.
        </p>
      </section>

      <section
        className={`pitch-slide pitch-validation ${current === 5 ? "is-active" : ""}`}
        aria-hidden={current !== 5}
      >
        <img
          className="pitch-validation-image"
          src={validationImg}
          alt="Compradora, produtor e facilitadora testando o protótipo da plataforma"
        />
        <div className="pitch-validation-shade" />
        <header className="pitch-heading-row">
          <div>
            <p className="pitch-kicker">Validação e próximo passo</p>
            <h2>
              A dor foi confirmada.
              <br />
              Agora vamos provar recorrência.
            </h2>
          </div>
          <p>O protótipo despertou interesse de quem compra e de quem produz.</p>
        </header>
        <div className="pitch-validation-grid">
          {validationSignals.map(({ icon: Icon, value, label, note }) => (
            <article key={label}>
              <Icon aria-hidden="true" />
              <strong>{value}</strong>
              <h3>{label}</h3>
              <p>{note}</p>
            </article>
          ))}
        </div>
        <div className="pitch-pilot-strip">
          <span>O piloto vai medir</span>
          {pilotMetrics.map((metric) => (
            <b key={metric}>{metric}</b>
          ))}
        </div>
      </section>

      <section
        className={`pitch-slide pitch-cta ${current === 6 ? "is-active" : ""}`}
        aria-hidden={current !== 6}
      >
        <img
          className="pitch-cta-image"
          src={partnershipImg}
          alt="Produtor e chef apertando as mãos durante a entrega de alimentos frescos"
        />
        <div className="pitch-cta-shade" />
        <div className="pitch-cta-orbit pitch-cta-orbit-one" />
        <div className="pitch-cta-orbit pitch-cta-orbit-two" />
        <div className="pitch-cta-content">
          <img src={logoImg} alt="" className="pitch-logo-mark" />
          <p className="pitch-kicker">Próximo passo</p>
          <h2>
            Transformar disponibilidade
            <br />
            em vendas locais.
          </h2>
          <p>
            Estamos buscando compradores e produtores para validar o piloto em uma operação real.
          </p>
          <div className="pitch-audience-row">
            {audienceTypes.map(({ icon: Icon, text }) => (
              <span key={text}>
                <Icon aria-hidden="true" />
                {text}
              </span>
            ))}
          </div>
          <a href="https://origem-conecta.vercel.app" className="pitch-cta-link">
            <Link2 aria-hidden="true" /> origem-conecta.vercel.app
          </a>
          <p className="pitch-closing">Mais produtores visíveis. Mais compradores abastecidos.</p>
        </div>
      </section>

      <nav className="pitch-controls" aria-label="Controles da apresentação">
        <button
          type="button"
          onClick={previous}
          disabled={current === 0}
          aria-label="Slide anterior"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className="pitch-progress-wrap">
          <div className="pitch-progress-meta">
            <span>
              {String(current + 1).padStart(2, "0")} / {String(SLIDE_COUNT).padStart(2, "0")}
            </span>
            <span>
              {pitchSlides[current].label} · {pitchSlides[current].duration}s
            </span>
          </div>
          <div className="pitch-progress">
            <span style={{ width: `${((current + 1) / SLIDE_COUNT) * 100}%` }} />
          </div>
          <div className="pitch-dots">
            {pitchSlides.map((slide, index) => (
              <button
                key={slide.label}
                type="button"
                className={index === current ? "is-current" : ""}
                onClick={() => goTo(index)}
                aria-label={`Ir para o slide ${index + 1}: ${slide.label}`}
                aria-current={index === current ? "step" : undefined}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={next}
          disabled={current === SLIDE_COUNT - 1}
          aria-label="Próximo slide"
        >
          <ArrowRight aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Alternar tela cheia"
          className="pitch-fullscreen"
        >
          <Expand aria-hidden="true" />
        </button>
      </nav>
    </main>
  );
}

function SproutMark() {
  return (
    <div className="pitch-sprout-mark" aria-hidden="true">
      <Leaf />
    </div>
  );
}
