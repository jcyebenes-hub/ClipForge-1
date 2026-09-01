import React from 'react';
import ProyectoPage from './[id]/page';

interface ProyectoDetallePageProps {
  proyectoId?: string;
  onNavigate?: (path: string) => void;
}

export const ProyectoDetallePage: React.FC<ProyectoDetallePageProps> = (props) => {
  return <ProyectoPage {...props} />;
};

export default ProyectoDetallePage;
