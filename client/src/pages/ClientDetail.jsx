import { useParams } from 'react-router-dom';
import ClientDetailCenter from '../components/ClientDetailCenter';

export default function ClientDetail() {
  const { id } = useParams();
  return (
    <div className="page-enter cd-wrap">
      <ClientDetailCenter clientId={parseInt(id)} />
    </div>
  );
}
