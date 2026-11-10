import numpy as np, wave
SR=44100;D=60;N=SR*D;t=np.arange(N)/SR
def f(n):return 440*2**((n-69)/12)
def env(a,b,fi=1.5,fo=1.5):
    return np.clip((t-a)/fi,0,1)*np.clip((b-t)/fo,0,1)
def pad(notes,a,b,vol=.1,fi=1.8,fo=1.8):
    s=np.zeros(N)
    for n in notes:
        for d in(-.08,.0,.08):
            fr=f(n)*2**(d/12*.1)
            s+=np.sin(2*np.pi*fr*t+np.sin(2*np.pi*.13*t))*.5+np.sin(4*np.pi*fr*t)*.12
    return s*env(a,b,fi,fo)*vol/len(notes)
def pluck(n,at,vol=.12,dec=1.6):
    s=np.zeros(N);i=int(at*SR);L=min(N-i,int(SR*4));tt=np.arange(L)/SR
    fr=f(n);w=np.sin(2*np.pi*fr*tt)+.35*np.sin(4*np.pi*fr*tt)*np.exp(-tt*4)+.12*np.sin(6*np.pi*fr*tt)*np.exp(-tt*6)
    w*=np.exp(-tt/dec*2.2)*np.clip(tt/.004,0,1)
    s[i:i+L]=w*vol;return s
m=np.zeros(N)
# hook: Am drone
m+=pad([33,40,45,48],0,5.8,.16,1.5,1.2)
# reveal & demo chords
ch=[(5,10.8,[48,55,59,64]),(10.4,16.8,[48,55,59,64]),(16.4,23.4,[45,52,57,60]),(23,29.8,[41,48,52,57]),(29.4,36.4,[43,50,55,59]),(36,42.2,[48,55,59,64]),(41.8,50.5,[53,60,64,69])]
for a,b,nn in ch:m+=pad(nn,a,b,.13)
# proof: sustained single note
m+=pad([60],50,55.6,.12,1.2,1.2)
# close: resolve C major
m+=pad([48,55,60,64,67],55,60,.16,1.2,2.4)
# piano-ish note on "first" ~8.4s
m+=pluck(76,8.4,.16,2.2)
# arpeggio from 10s
arp={10:[72,76,79,76],16.4:[69,72,76,72],23:[65,69,72,69],29.4:[67,71,74,71],36:[72,76,79,76],41.8:[77,81,84,81]}
keys=sorted(arp);beat=60/72/2
x=10.4
while x<49.5:
    ks=[k for k in keys if k<=x][-1];seq=arp[ks]
    vol=.05 if x<23 else .075
    m+=pluck(seq[int(round((x-10)/beat))%4],x,vol,1.1);x+=beat*2
m+=pluck(60,0,0)  # noop
# click at 27s
i=int(27*SR);cl=np.random.RandomState(1).randn(int(SR*.02))*np.exp(-np.arange(int(SR*.02))/(SR*.003));m[i:i+len(cl)]+=cl*.04
# slow pulse for warmth
m*=1+.03*np.sin(2*np.pi*.1*t)
m=m/np.abs(m).max()*.75
fade=np.clip((D-t)/2.0,0,1)*np.clip(t/.5,0,1);m*=fade
L=m.copy();R=np.roll(m,int(SR*.012))
st=(np.stack([L,R],1)*32767).astype('<i2')
w=wave.open('music_dry.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(st.tobytes());w.close()
