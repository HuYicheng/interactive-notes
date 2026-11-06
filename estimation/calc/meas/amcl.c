/* Time one AMCL-style likelihood-field update: N particles x 61 beams on a 120 x 90 grid (5 cm), as in nav2_amcl's
   likelihood_field_model.cpp (pz = z_hit*exp(-z^2/(2 sigma^2)) + z_rand/range_max; p += pz^3).
   gcc -O2 amcl.c -o amcl -lm && ./amcl */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>
#define GW 120
#define GH 90
static float dist[GW*GH];
static double now(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec*1e-9;}
static int occ(int i,int j){double x=(i+.5)*.05,y=(j+.5)*.05;
  if(x<.05||y<.05||x>5.95||y>4.45)return 1;               /* walls */
  if(y>3.9&&x>.9)return 1; if(x<.9&&y>3.6)return 1;          /* north counter, fridge */
  if(x>3.0&&x<3.6&&y>3.7)return 1; if(y<.6)return 1;          /* oven cabinet, south counter */
  if(x>2.1&&x<3.9&&y>1.8&&y<2.7)return 1; return 0;}          /* island */
int cmp(const void*a,const void*b){double d=*(double*)a-*(double*)b;return d<0?-1:d>0;}
int main(void){
  /* brute-force distance field, capped at 2.0 m (laser_likelihood_max_dist) */
  int oi[GW*GH],no=0; for(int j=0;j<GH;j++)for(int i=0;i<GW;i++)if(occ(i,j))oi[no++]=j*GW+i;
  for(int j=0;j<GH;j++)for(int i=0;i<GW;i++){double best=2.0;for(int k=0;k<no;k++){int ii=oi[k]%GW,jj=oi[k]/GW;double d=.05*hypot(ii-i,jj-j);if(d<best)best=d;}dist[j*GW+i]=best;}
  int Ns[3]={500,2000,5000}; double sig=0.2,zh=.5,zr=.5,rmax=10.0;
  double rng[61],brg[61]; for(int k=0;k<61;k++){brg[k]=(-135+k*4.5)*M_PI/180;rng[k]=1.0+2.0*fabs(sin(k*.37));}
  for(int t=0;t<3;t++){int N=Ns[t]; double *px=malloc(N*8),*py=malloc(N*8),*pt=malloc(N*8),*w=malloc(N*8);
    srand(16); for(int n=0;n<N;n++){px[n]=1+4*(rand()/(double)RAND_MAX);py[n]=1+2.5*(rand()/(double)RAND_MAX);pt[n]=2*M_PI*(rand()/(double)RAND_MAX);}
    double ts[51];
    for(int rep=0;rep<51;rep++){double t0=now(),tot=0;
      for(int n=0;n<N;n++){double p=1.0;for(int k=0;k<61;k++){double a=pt[n]+brg[k];double hx=px[n]+.2*cos(pt[n])+rng[k]*cos(a),hy=py[n]+.2*sin(pt[n])+rng[k]*sin(a);
          int i=(int)floor(hx/.05),j=(int)floor(hy/.05);double z=(i<0||j<0||i>=GW||j>=GH)?2.0:dist[j*GW+i];
          double pz=zh*exp(-(z*z)/(2*sig*sig))+zr/rmax;p+=pz*pz*pz;}
        w[n]=p;tot+=p;}
      ts[rep]=now()-t0; if(tot<0)printf("x");}
    qsort(ts,51,8,cmp); printf("particles %d x 61 beams: median %.3f ms per update\n",N,ts[25]*1e3);
    free(px);free(py);free(pt);free(w);}
  return 0;}
