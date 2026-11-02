import { Component } from '@angular/core';

/** Numero de WhatsApp del asesor: indicativo de pais, sin "+" ni espacios. */
const NUMERO_ASESOR = '573001234567';
const MENSAJE = 'Hola, necesito ayuda de un asesor de CarnesEUS.';

/** Boton flotante que abre un chat de WhatsApp con el asesor. */
@Component({
  selector: 'app-boton-whatsapp',
  template: `
    <a
      class="wa"
      [href]="enlace"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hablar con un asesor por WhatsApp"
    >
      <svg class="wa__icono" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
          fill="currentColor"
        />
      </svg>
      <span class="wa__texto">Hablar con un asesor</span>
    </a>
  `,
  styles: `
    .wa {
      position: fixed;
      right: 1.25rem;
      bottom: 1.25rem;
      z-index: 50;
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.875rem;
      border-radius: 999px;
      background: #1f9d55;
      color: #ffffff;
      font-size: 0.9375rem;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
      transition: background 0.15s ease, transform 0.15s ease;
    }

    .wa:hover {
      background: #25b866;
      transform: translateY(-2px);
    }

    .wa:focus-visible {
      outline: 2px solid #e0b95f;
      outline-offset: 3px;
    }

    .wa__icono {
      flex: none;
      width: 1.5rem;
      height: 1.5rem;
    }

    /* En celular solo se ve el icono, para no tapar el contenido. */
    .wa__texto {
      display: none;
    }

    @media (min-width: 40rem) {
      .wa {
        padding: 0.875rem 1.25rem;
      }

      .wa__texto {
        display: inline;
      }
    }
  `,
})
export class BotonWhatsapp {
  protected readonly enlace = `https://wa.me/${NUMERO_ASESOR}?text=${encodeURIComponent(MENSAJE)}`;
}