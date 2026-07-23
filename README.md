# GL-3DPRT-SP/S 全路径动力学模拟

双击 `index.html` 即可离线运行，也可通过任意静态 HTTP 服务打开。

数据由 `scripts/build-dynamics-animation.py` 从正式 nominal jerk 全路径 CSV 生成。
正式图层为当前参数计算包络；58点资料仅记录为 `unverified_reference`，不参与路径或正式图层。
高位不相连可行区间单独标为“隔离区间”；路径只沿与底层连续相通的分量上升，不跨越空洞。
算法下拉包含局部贪心、平衡姿态和强姿态三种严格解析方案；三者均命中同一 TCP 路径并使用相同当前参数口径。
详细数值和原因说明见 `algorithm-comparison.md`，对比图见 `algorithm-comparison.png`。
电机扭矩为 η=1 的最不利单电机轴等效需求理论下限；不是厂家最终选型扭矩。
右侧所有工况、硬件组和臂共用固定量程：扭矩 0～9 N·m，电缸线速度 -100～100 mm/s。

## 生成校验

- 局部贪心 · XY / Z 150 mm/s: samples=25145, duration=1225.9938s, cylinder speed peaks=66.124,52.638,55.064 mm/s
-   第一组: eta=1 motor torque peaks=1.490,1.968,1.465 Nm
-   第二组: eta=1 motor torque peaks=1.590,2.099,1.465 Nm
- 局部贪心 · XY / Z 200 mm/s: samples=19260, duration=934.0072s, cylinder speed peaks=88.040,70.174,73.288 mm/s
-   第一组: eta=1 motor torque peaks=1.524,2.000,1.499 Nm
-   第二组: eta=1 motor torque peaks=1.625,2.134,1.499 Nm
- 局部贪心 · XY 200 / Z 50 mm/s: samples=21019, duration=1024.0707s, cylinder speed peaks=88.040,70.174,73.288 mm/s
-   第一组: eta=1 motor torque peaks=1.524,2.000,1.409 Nm
-   第二组: eta=1 motor torque peaks=1.625,2.134,1.409 Nm
- 平衡姿态 · XY / Z 150 mm/s: samples=25145, duration=1225.9938s, cylinder speed peaks=57.572,47.088,31.782 mm/s
-   第一组: eta=1 motor torque peaks=1.491,1.964,1.460 Nm
-   第二组: eta=1 motor torque peaks=1.590,2.095,1.460 Nm
- 平衡姿态 · XY / Z 200 mm/s: samples=19260, duration=934.0072s, cylinder speed peaks=75.817,62.805,42.394 mm/s
-   第一组: eta=1 motor torque peaks=1.524,1.996,1.499 Nm
-   第二组: eta=1 motor torque peaks=1.626,2.129,1.499 Nm
- 平衡姿态 · XY 200 / Z 50 mm/s: samples=21019, duration=1024.0707s, cylinder speed peaks=75.817,62.805,42.394 mm/s
-   第一组: eta=1 motor torque peaks=1.524,1.996,1.409 Nm
-   第二组: eta=1 motor torque peaks=1.626,2.129,1.409 Nm
- 强姿态 · XY / Z 150 mm/s: samples=25145, duration=1225.9938s, cylinder speed peaks=56.650,43.645,23.561 mm/s
-   第一组: eta=1 motor torque peaks=1.491,1.964,1.460 Nm
-   第二组: eta=1 motor torque peaks=1.590,2.095,1.460 Nm
- 强姿态 · XY / Z 200 mm/s: samples=19260, duration=934.0072s, cylinder speed peaks=73.499,58.195,31.416 mm/s
-   第一组: eta=1 motor torque peaks=1.525,1.997,1.499 Nm
-   第二组: eta=1 motor torque peaks=1.626,2.130,1.499 Nm
- 强姿态 · XY 200 / Z 50 mm/s: samples=21019, duration=1024.0707s, cylinder speed peaks=73.499,58.195,31.416 mm/s
-   第一组: eta=1 motor torque peaks=1.525,1.997,1.409 Nm
-   第二组: eta=1 motor torque peaks=1.626,2.130,1.409 Nm
