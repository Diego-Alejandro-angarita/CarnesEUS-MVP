export interface ZonaMedellin {
  codigo: number;
  nombre: string;
}

export const MUNICIPIO_COBERTURA = 'Medellin';

export const COMUNAS_MEDELLIN: readonly ZonaMedellin[] = [
  { codigo: 1, nombre: 'Popular' },
  { codigo: 2, nombre: 'Santa Cruz' },
  { codigo: 3, nombre: 'Manrique' },
  { codigo: 4, nombre: 'Aranjuez' },
  { codigo: 5, nombre: 'Castilla' },
  { codigo: 6, nombre: 'Doce de Octubre' },
  { codigo: 7, nombre: 'Robledo' },
  { codigo: 8, nombre: 'Villa Hermosa' },
  { codigo: 9, nombre: 'Buenos Aires' },
  { codigo: 10, nombre: 'La Candelaria' },
  { codigo: 11, nombre: 'Laureles-Estadio' },
  { codigo: 12, nombre: 'La America' },
  { codigo: 13, nombre: 'San Javier' },
  { codigo: 14, nombre: 'El Poblado' },
  { codigo: 15, nombre: 'Guayabal' },
  { codigo: 16, nombre: 'Belen' },
];

export const CORREGIMIENTOS_MEDELLIN: readonly ZonaMedellin[] = [
  { codigo: 50, nombre: 'San Sebastian de Palmitas' },
  { codigo: 60, nombre: 'San Cristobal' },
  { codigo: 70, nombre: 'Altavista' },
  { codigo: 80, nombre: 'San Antonio de Prado' },
  { codigo: 90, nombre: 'Santa Elena' },
];