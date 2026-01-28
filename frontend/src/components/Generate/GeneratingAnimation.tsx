export default function GeneratingAnimation() {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className="absolute w-32 h-32 rounded-full opacity-70 animate-blob-1"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, 0) 70%)',
            top: '10%',
            left: '10%',
            filter: 'blur(20px)',
          }}
        />
        <div
          className="absolute w-36 h-36 rounded-full opacity-60 animate-blob-2"
          style={{
            background: 'radial-gradient(circle, rgba(167, 139, 250, 0.8) 0%, rgba(167, 139, 250, 0) 70%)',
            top: '20%',
            right: '5%',
            filter: 'blur(25px)',
          }}
        />
        <div
          className="absolute w-28 h-28 rounded-full opacity-70 animate-blob-3"
          style={{
            background: 'radial-gradient(circle, rgba(196, 181, 253, 0.8) 0%, rgba(196, 181, 253, 0) 70%)',
            bottom: '15%',
            left: '20%',
            filter: 'blur(18px)',
          }}
        />
        <div
          className="absolute w-24 h-24 rounded-full opacity-50 animate-blob-4"
          style={{
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.9) 0%, rgba(124, 58, 237, 0) 70%)',
            bottom: '25%',
            right: '15%',
            filter: 'blur(15px)',
          }}
        />
      </div>
      
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-600/10 animate-pulse-slow" />
    </div>
  );
}
