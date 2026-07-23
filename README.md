# GL-3DPRT-SP/S 全路径动力学模拟

这是可独立运行的静态网页发布包，不依赖构建步骤。

- 直接双击 `index.html` 可离线运行。
- 也可在仓库根目录执行 `python3 -m http.server 8000`，然后打开
  `http://localhost:8000/`。
- GitHub Pages 可直接以 `main` 分支根目录作为发布源。

`data.js` 由上游工程的 `scripts/build-dynamics-animation.py` 从正式 nominal jerk
全路径 CSV 生成；本仓库保存网页运行所需的冻结数据快照。
算法下拉包含现有贪心、平衡姿态和强姿态三种严格解析方案；三者均命中同一 TCP 路径并使用相同限位。
详细数值和原因说明见 `algorithm-comparison.md`，对比图见 `algorithm-comparison.png`。
电机扭矩为 η=1 的最不利单电机轴等效需求理论下限；不是厂家最终选型扭矩。
右侧所有工况、硬件组和臂共用固定量程：扭矩 0～9 N·m，电缸线速度 -120～120 mm/s。

## 生成校验

- 现有贪心 · XY / Z 150 mm/s: samples=12664, duration=623.2865s, cylinder speed peaks=81.771,45.755,69.582 mm/s
-   第一组: eta=1 motor torque peaks=1.232,1.668,1.158 Nm
-   第二组: eta=1 motor torque peaks=1.315,1.779,1.158 Nm
- 现有贪心 · XY / Z 200 mm/s: samples=9580, duration=471.7275s, cylinder speed peaks=109.025,61.006,92.776 mm/s
-   第一组: eta=1 motor torque peaks=1.309,1.697,1.178 Nm
-   第二组: eta=1 motor torque peaks=1.396,1.810,1.178 Nm
- 现有贪心 · XY 200 / Z 50 mm/s: samples=10777, duration=531.7576s, cylinder speed peaks=109.025,61.006,92.776 mm/s
-   第一组: eta=1 motor torque peaks=1.308,1.697,1.104 Nm
-   第二组: eta=1 motor torque peaks=1.395,1.810,1.104 Nm
- 平衡姿态 · XY / Z 150 mm/s: samples=12664, duration=623.2865s, cylinder speed peaks=24.282,19.078,41.495 mm/s
-   第一组: eta=1 motor torque peaks=1.183,1.631,1.140 Nm
-   第二组: eta=1 motor torque peaks=1.262,1.740,1.140 Nm
- 平衡姿态 · XY / Z 200 mm/s: samples=9580, duration=471.7275s, cylinder speed peaks=32.376,25.438,55.327 mm/s
-   第一组: eta=1 motor torque peaks=1.199,1.655,1.159 Nm
-   第二组: eta=1 motor torque peaks=1.279,1.766,1.159 Nm
- 平衡姿态 · XY 200 / Z 50 mm/s: samples=10777, duration=531.7576s, cylinder speed peaks=32.376,19.639,55.327 mm/s
-   第一组: eta=1 motor torque peaks=1.192,1.627,1.090 Nm
-   第二组: eta=1 motor torque peaks=1.271,1.736,1.090 Nm
- 强姿态 · XY / Z 150 mm/s: samples=12664, duration=623.2865s, cylinder speed peaks=21.161,15.162,30.988 mm/s
-   第一组: eta=1 motor torque peaks=1.184,1.634,1.142 Nm
-   第二组: eta=1 motor torque peaks=1.263,1.743,1.142 Nm
- 强姿态 · XY / Z 200 mm/s: samples=9580, duration=471.7275s, cylinder speed peaks=27.954,20.215,41.314 mm/s
-   第一组: eta=1 motor torque peaks=1.201,1.657,1.160 Nm
-   第二组: eta=1 motor torque peaks=1.281,1.767,1.160 Nm
- 强姿态 · XY 200 / Z 50 mm/s: samples=10777, duration=531.7576s, cylinder speed peaks=27.954,16.446,41.314 mm/s
-   第一组: eta=1 motor torque peaks=1.188,1.636,1.092 Nm
-   第二组: eta=1 motor torque peaks=1.267,1.745,1.092 Nm
