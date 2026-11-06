/* Time one 15-state EKF predict (P = F P F^T + Q) + update with a 6-D measurement (S = H P H^T + R, K = P H^T S^-1,
   P = (I - K H) P), dense loops, like robot_localization's state size.  gcc -O2 ekf.c -o ekf -lm && ./ekf */
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <math.h>
#define N 15
#define M 6
static double now(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec*1e-9;}
static void mm(int a,int b,int c,const double*A,const double*B,double*C){for(int i=0;i<a;i++)for(int j=0;j<c;j++){double s=0;for(int k=0;k<b;k++)s+=A[i*b+k]*B[k*c+j];C[i*c+j]=s;}}
static void tr(int a,int b,const double*A,double*T){for(int i=0;i<a;i++)for(int j=0;j<b;j++)T[j*a+i]=A[i*b+j];}
static int inv(int n,double*A,double*I){for(int i=0;i<n;i++)for(int j=0;j<n;j++)I[i*n+j]=i==j;for(int c=0;c<n;c++){double p=A[c*n+c];if(fabs(p)<1e-15)return 1;for(int j=0;j<n;j++){A[c*n+j]/=p;I[c*n+j]/=p;}for(int r=0;r<n;r++)if(r!=c){double f=A[r*n+c];for(int j=0;j<n;j++){A[r*n+j]-=f*A[c*n+j];I[r*n+j]-=f*I[c*n+j];}}}return 0;}
int main(void){double F[N*N],P[N*N],Q[N*N],H[M*N],R[M*M],T1[N*N],T2[N*N],Ft[N*N],Ht[N*M],PHt[N*M],S[M*M],Si[M*M],K[N*M],KH[N*N],ImKH[N*N];
  memset(F,0,sizeof F);memset(P,0,sizeof P);memset(Q,0,sizeof Q);memset(H,0,sizeof H);memset(R,0,sizeof R);
  for(int i=0;i<N;i++){F[i*N+i]=1;P[i*N+i]=1e-2;Q[i*N+i]=1e-4;} for(int i=0;i<6;i++)F[i*N+i+6]=0.02;
  for(int i=0;i<M;i++){H[i*N+i]=1;R[i*M+i]=1e-3;}
  double ts[1001];
  for(int rep=0;rep<1001;rep++){double t0=now();
    mm(N,N,N,F,P,T1);tr(N,N,F,Ft);mm(N,N,N,T1,Ft,T2);for(int i=0;i<N*N;i++)P[i]=T2[i]+Q[i];
    tr(M,N,H,Ht);mm(N,N,M,P,Ht,PHt);mm(M,N,M,H,PHt,S);for(int i=0;i<M*M;i++)S[i]+=R[i];inv(M,S,Si);mm(N,M,M,PHt,Si,K);
    mm(N,M,N,K,H,KH);for(int i=0;i<N*N;i++)ImKH[i]=(i%(N+1)==0)-KH[i];mm(N,N,N,ImKH,P,T2);memcpy(P,T2,sizeof P);
    ts[rep]=now()-t0;}
  for(int i=0;i<1001;i++)for(int j=i+1;j<1001;j++)if(ts[j]<ts[i]){double t=ts[i];ts[i]=ts[j];ts[j]=t;}
  printf("15-state EKF predict + 6-D update: median %.2f us\n",ts[500]*1e6);return 0;}
