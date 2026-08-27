import dynamic from 'next/dynamic';

const ZunaReader = dynamic(() => import('../components/zuna-reader'));

export default function HomePage() {
  return <ZunaReader />;
}
